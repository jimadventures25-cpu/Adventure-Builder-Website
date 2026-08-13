(() => {
  'use strict';

  function isRemovableMarker(value) {
    return Boolean(value && typeof value.remove === 'function' && typeof value.setLngLat === 'function');
  }

  class TrailMarkerManager {
    constructor() {
      this._markers = [];
    }

    add(marker) {
      if (!isRemovableMarker(marker)) {
        throw new TypeError('TrailMarkerManager only accepts MapLibre marker instances.');
      }
      this._markers.push(marker);
      return marker;
    }

    replace(markers) {
      this.clear();
      for (const marker of markers || []) this.add(marker);
      return this.values();
    }

    clear() {
      const current = this._markers;
      this._markers = [];
      for (const marker of current) {
        try { marker.remove(); } catch (error) { console.warn('Trail marker cleanup failed:', error); }
      }
    }

    values() {
      return this._markers.slice();
    }

    get size() {
      return this._markers.length;
    }
  }

  window.AdventureBuilderTrailMarkerManager = Object.freeze({
    create: () => new TrailMarkerManager(),
    isRemovableMarker
  });
})();
