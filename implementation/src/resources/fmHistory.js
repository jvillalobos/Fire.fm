/**
 * Copyright (c) 2008-2010, Jose Enrique Bolanos, Jorge Villalobos
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *  * Neither the name of Jose Enrique Bolanos, Jorge Villalobos nor the names
 *    of its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
 * OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Ce = Components.Exception;

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmPlayer.js");
Components.utils.import("resource://firefm/fmStation.js");

/**
 * FireFM History. Creates history entries for artists when tracks are loaded.
 */
FireFM.History = {

  /* Logger for this object. */
  _logger : null,
  /* History service */
  _historyService : null,
  /* Favicon service */
  _faviconService : null,
  /* History toggle preference object. */
  _historyPref : null,
  /* History size preference object. */
  _historySizePref : null,
  /* Station history preference object. */
  _stationHistoryPref : null,
  /* Store in Places history preference object. */
  _storeInPlacesPref : null,
  /* The station history array. */
  _stationHistory : [],
  /* The size of the station history. */
  _historySize : 0,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFM.History");
    this._logger.debug("init");

    this._historyService =
      Cc["@mozilla.org/browser/nav-history-service;1"].
        getService(Ci.nsIGlobalHistory2);
    this._faviconService =
      Cc["@mozilla.org/browser/favicon-service;1"].
        getService(Ci.nsIFaviconService);

    this._historyPref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "recent.enabled");
    this._historySizePref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "recent.historySize");
    this._stationHistoryPref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "recent.history");
    this._storeInPlacesPref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "storeHistory");

    this._getHistoryPreferences();

    FireFM.obsService.addObserver(
      this, FireFM.Station.TOPIC_STATION_OPENING, false);
    FireFM.obsService.addObserver(
      this, FireFM.Player.TOPIC_TRACK_LOADED, false);
  },

  /**
   * Gets an array with the most recently played stations.
   * @return array with the most recently played stations.
   */
  get stationHistory() {
    this._logger.trace("[getter] stationHistory");
    // XXX: this is just a hacky way of duplicating the array.
    return this._stationHistory.concat([]);
  },

  /**
   * Clears the recent station history.
   */
  clearRecentHistory : function() {
    this._logger.debug("clearRecentHistory");
    // clear the list.
    this._stationHistory.splice(0, this._stationHistory.length);
    // store the preference.
    this._setRecentHistoryPreference();
  },

  /**
   * Clears the Fire.fm entries in the browser history.
   */
  clearPlacesHistory : function() {
    this._logger.debug("clearPlacesHistory");

    let query;
    let queryOptions;
    let result;
    let node;
    let uris;

    try {
      this._historyService.QueryInterface(Ci.nsINavHistoryService);

      query = this._historyService.getNewQuery();
      queryOptions = this._historyService.getNewQueryOptions();

      query.uri = FireFM.createURI("firefm://");
      query.uriIsPrefix = true;

      result = this._historyService.executeQuery(query, queryOptions).root;

      this._historyService.QueryInterface(Ci.nsIBrowserHistory);

      uris = new Array();

      result.containerOpen = true;
      for (var i = result.childCount - 1; 0 <= i; i--) {
        uris.push(result.getChild(i).uri);
      }
      result.containerOpen = false;

      for (var i = uris.length - 1; 0 <= i; i--) {
        this._historyService.removePage(FireFM.createURI(uris[i]));
      }
    } catch (e) {
      this._logger.warn("Error clearing the places history: " + e);
    }
  },

  /**
   * Records the given station information in the browser history.
   * @param aStation the station to record.
   * @param aImagePath the path to an icon for the station (can be null).
   */
  _recordStation : function(aStation, aImagePath) {
    this._logger.trace("_recordStation");

    if (this._storeInPlacesPref.value && !FireFM.Private.isPrivate) {
      let stationURI = null;
      let title = null;
      let imageURI = null;

      if (null != aImagePath) {
        imageURI = FireFM.createURI(aImagePath);
      }

      switch (aStation.type) {
        case FireFM.Station.TYPE_ARTIST:
          stationURI =
            FireFM.createURI("firefm://station/artist/" + escape(aStation.id));
          break;
        case FireFM.Station.TYPE_RECOMMENDED:
          stationURI =
            FireFM.createURI(
              "firefm://station/recommended/" + escape(aStation.id));
          break;
        case FireFM.Station.TYPE_USER:
          stationURI =
            FireFM.createURI("firefm://station/user/" + escape(aStation.id));
          break;
        case FireFM.Station.TYPE_TAG:
          stationURI =
            FireFM.createURI("firefm://station/tag/" + escape(aStation.id));
          break;
        case FireFM.Station.TYPE_NEIGHBORHOOD:
          stationURI =
            FireFM.createURI(
              "firefm://station/neighborhood/" + escape(aStation.id));
          break;
        default:
          this._logger.error("_recordStation: Unsopported station type.");
          break;
      }

      title =
        FireFM.overlayBundle.formatStringFromName(
          "firefm.station.listenTo.label", [ aStation.title ], 1);

      if (null != stationURI) {
        this._historyService.QueryInterface(Ci.nsIGlobalHistory2);

        if (!this._historyService.isVisited(stationURI)) {
          this._historyService.addURI(stationURI, false, true, null);
        }

        this._historyService.setPageTitle(stationURI, title);

        if (null != imageURI) {
          this._faviconService.setAndLoadFaviconForPage(
            stationURI, imageURI, true);
        }
      }
    }
  },

  /**
   * Stores the station as the most recently loaded station.
   * @param aStation the station to store.
   */
  _storeRecentStation : function(aStation) {
    this._logger.trace("_storeRecentStation");

    if (this._historyPref.value && !FireFM.Private.isPrivate &&
        (0 < this._historySize)) {
      let recentCount = this._stationHistory.length;
      let recent;
      let newPrefValue;

      for (let i = 0; i < recentCount; i++) {
        recent = this._stationHistory[i];

        // look at the current list and remove any instance of the same station.
        if ((aStation.id == recent.id) && (aStation.type == recent.type)) {
          this._stationHistory.splice(i, 1);
          recentCount--;
          break;
        }
      }

      // remove the last item on the list if necessary.
      if (this._historySize == recentCount) {
        this._stationHistory.pop();
      }

      // add the station at the top of the list.
      this._stationHistory.unshift(aStation);

      // set the new preference.
      this._setRecentHistoryPreference();
    }
  },

  /**
   * Gets the stored preferences for the history of recent stations. The values
   * are set in this object.
   */
  _getHistoryPreferences : function() {
    this._logger.trace("_getHistoryPreferences");

    // The absolute maximum to keep in the recent station history.
    const HISTORY_SIZE_MAX = 50;

    let historyStr = this._stationHistoryPref.value;
    // set the history size.
    this._historySize = this._historySizePref.value;
    // keep the value within reasonable constrains.
    if ((null == this._historySize) || (0 > this._historySize)) {
      this._historySize = 0;
    } else if (HISTORY_SIZE_MAX < this._historySize) {
      this._historySize = HISTORY_SIZE_MAX;
    }

    // set the station history.
    try {
      let arr = JSON.parse(historyStr);
      let arrItem;

      for (let i = 0; ((i < arr.length) && (i < this._historySize)); i++) {
        arrItem = arr[i];
        this._stationHistory.push(
          new FireFM.StationInfo(arrItem.id, arrItem.type));
      }
    } catch (e) {
      this._logger.error(e);
      this._logger.warn(
        "_getHistoryPreferences. Invalid value for history preference: " +
        historyStr);
      this._stationHistory = [];
    }
  },

  /**
   * Sets the recent history preference with the current state of the recent
   * stations list.
   */
  _setRecentHistoryPreference : function() {
    this._logger.trace("_setRecentHistoryPreference");

    let recentCount = this._stationHistory.length;
    let newPrefValue = "[ ";

    // generate the new value.
    for (let i = 0; i < recentCount; i++) {
      if (0 != i) {
        newPrefValue += ", "
      }

      newPrefValue += this._stationHistory[i].toJSON();
    }

    newPrefValue += " ]";

    this._logger.debug(
      "_setRecentHistoryPreference. Preference value: " + newPrefValue);
    // store the new value in the preference.
    this._stationHistoryPref.value = newPrefValue;
  },

  /**
   * Observes topic notifications.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data relating to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    switch (aTopic) {
      case FireFM.Station.TOPIC_STATION_OPENING:
        if (null != aSubject) {
          let station = FireFM.unwrap(aSubject);
          // save station to the recent station history.
          this._storeRecentStation(station);
          // save station to the user's Places history.
          this._recordStation(station, null);
        }

        break;

      case FireFM.Player.TOPIC_TRACK_LOADED:
        let track = FireFM.unwrap(aSubject);
        let station =
          new FireFM.StationInfo(track.artist, FireFM.Station.TYPE_ARTIST);

        this._recordStation(station, track.imagePath);
        break;
    }
  }
};

/**
 * FireFM.History constructor.
 */
(function() {
  this.init();
}).apply(FireFM.History);
