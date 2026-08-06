const MILES_TO_METRES = 1609.344;
const KILOMETRES_TO_METRES = 1000;

function metres(length, units = 'kilometers') {
  const value = Number(length) || 0;
  return units === 'miles' ? value * MILES_TO_METRES : value * KILOMETRES_TO_METRES;
}

function manoeuvreDescriptor(type) {
  const table = {
    0: ['continue', 'straight'], 1: ['depart', 'straight'], 2: ['depart', 'right'], 3: ['depart', 'left'],
    4: ['arrive', 'straight'], 5: ['arrive', 'right'], 6: ['arrive', 'left'], 7: ['new name', 'straight'],
    8: ['continue', 'straight'], 9: ['turn', 'slight right'], 10: ['turn', 'right'], 11: ['turn', 'sharp right'],
    12: ['turn', 'uturn'], 13: ['turn', 'uturn'], 14: ['turn', 'sharp left'], 15: ['turn', 'left'],
    16: ['turn', 'slight left'], 17: ['on ramp', 'straight'], 18: ['on ramp', 'right'], 19: ['on ramp', 'left'],
    20: ['off ramp', 'right'], 21: ['off ramp', 'left'], 22: ['fork', 'straight'], 23: ['fork', 'right'],
    24: ['fork', 'left'], 25: ['merge', 'straight'], 26: ['roundabout', 'right'], 27: ['exit roundabout', 'right'],
    28: ['ferry', 'straight'], 29: ['ferry', 'straight'], 34: ['merge', 'right'], 35: ['merge', 'left']
  };
  return table[Number(type)] || ['continue', 'straight'];
}

function lineCoordinates(shape) {
  if (shape?.type === 'LineString' && Array.isArray(shape.coordinates)) return shape.coordinates;
  if (shape?.geometry?.type === 'LineString' && Array.isArray(shape.geometry.coordinates)) return shape.geometry.coordinates;
  return [];
}

function normaliseValhalla(payload) {
  const trip = payload?.trip;
  if (!trip || Number(trip.status) !== 0 || !Array.isArray(trip.legs) || !trip.legs.length) {
    const message = trip?.status_message || payload?.error || 'Valhalla did not return a route.';
    throw new Error(message);
  }
  const units = trip.units || 'kilometers';
  const routeCoordinates = [];
  const legs = trip.legs.map((leg) => {
    const coords = lineCoordinates(leg.shape);
    const offset = routeCoordinates.length;
    coords.forEach((coordinate, index) => {
      if (index === 0 && routeCoordinates.length && routeCoordinates.at(-1)[0] === coordinate[0] && routeCoordinates.at(-1)[1] === coordinate[1]) return;
      routeCoordinates.push(coordinate);
    });
    const steps = (leg.maneuvers || []).map((item) => {
      const [type, modifier] = manoeuvreDescriptor(item.type);
      const localIndex = Math.max(0, Math.min(coords.length - 1, Number(item.begin_shape_index) || 0));
      const location = coords[localIndex] || coords[0] || null;
      const streetNames = Array.isArray(item.street_names) ? item.street_names : [];
      return {
        distance: metres(item.length, units),
        duration: Number(item.time) || 0,
        name: streetNames[0] || '',
        ref: streetNames.find((name) => /^(?:M|A|B)\d+/i.test(name)) || '',
        destinations: item.sign?.exit_toward_elements?.map((entry) => entry.text).filter(Boolean).join(', ') || '',
        exits: item.sign?.exit_number_elements?.map((entry) => entry.text).filter(Boolean).join(', ') || '',
        maneuver: {
          type,
          modifier,
          instruction: item.instruction || item.verbal_pre_transition_instruction || 'Continue',
          location,
          exit: Number(item.roundabout_exit_count) || undefined
        },
        intersections: []
      };
    });
    return {
      distance: metres(leg.summary?.length, units),
      duration: Number(leg.summary?.time) || 0,
      steps,
      incidents: [],
      annotation: { closure: [] }
    };
  });
  return {
    code: 'Ok',
    routes: [{
      distance: metres(trip.summary?.length, units),
      duration: Number(trip.summary?.time) || 0,
      geometry: { type: 'LineString', coordinates: routeCoordinates },
      legs
    }],
    waypoints: [],
    gbca_provider: 'valhalla',
    gbca_vehicle_aware: false,
    gbca_vehicle_warning: ''
  };
}

function costingFor(transport) {
  if (transport === 'walking') return 'pedestrian';
  if (transport === 'bicycle') return 'bicycle';
  if (transport === 'motorbike') return 'motor_scooter';
  return 'auto';
}

function buildValhallaRequest(input) {
  const points = (input.points || []).map((point, index) => {
    const location = { lat: Number(point.lat), lon: Number(point.lon), type: 'break' };
    if (index === 0 && input.forwardReroute && Number.isFinite(Number(input.heading))) {
      location.heading = ((Number(input.heading) % 360) + 360) % 360;
      location.heading_tolerance = Math.max(10, Math.min(90, Number(input.headingTolerance) || 40));
      location.radius = Math.max(20, Math.min(90, Number(input.searchRadius) || 45));
      location.search_cutoff = Math.max(80, Math.min(250, location.radius * 3));
    }
    return location;
  });
  if (points.length < 2 || points.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lon))) {
    throw new Error('At least two valid route points are required.');
  }
  const costing = costingFor(input.transport);
  const options = {
    locations: points,
    costing,
    units: 'miles',
    language: 'en-GB',
    directions_type: 'instructions',
    shape_format: 'geojson',
    alternates: input.routeStyle === 'scenic' ? 2 : 0
  };
  const costingOptions = {};
  if (input.avoidMotorways) costingOptions.use_highways = 0;
  if (input.avoidTolls) costingOptions.use_tolls = 0;
  if (input.avoidFerries) costingOptions.use_ferry = 0;
  if (input.routeStyle === 'shortest') costingOptions.shortest = true;
  if (input.routeStyle === 'scenic' && costing === 'auto') {
    costingOptions.use_highways = Math.min(Number(costingOptions.use_highways ?? 1), 0.55);
    costingOptions.use_tolls = Math.min(Number(costingOptions.use_tolls ?? 1), 0.4);
  }
  if (input.forwardReroute && costing === 'auto') {
    costingOptions.maneuver_penalty = input.allowUTurn ? 12 : 28;
    costingOptions.alley_penalty = 20;
    costingOptions.destination_only_penalty = 30;
  }
  if (Object.keys(costingOptions).length) options.costing_options = { [costing]: costingOptions };
  return options;
}

export { buildValhallaRequest, normaliseValhalla };
