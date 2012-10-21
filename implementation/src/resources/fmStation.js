/**
 * Copyright (c) 2008, Jose Enrique Bolanos, Jorge Villalobos
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmEntities.js");
Components.utils.import("resource://firefm/fmPlaylist.js");
Components.utils.import("resource://firefm/fmPlayer.js");
Components.utils.import("resource://firefm/fmRemote.js");

// The topic that indicates the application is about to quit.
const TOPIC_QUIT_APPLICATION = "quit-application";

/**
 * Handles station-related operations, namely picking a station and starting
 * playback.
 */
FireFM.Station = {
  // Topic notifications sent from this object.
  get TOPIC_STATION_SET() { return "firefm-station-set"; },
  get TOPIC_STATION_SEARCHING() { return "firefm-station-searching"; },
  get TOPIC_STATION_LOADING() { return "firefm-station-loading"; },
  get TOPIC_STATION_OPENING() { return "firefm-station-opening"; },
  get TOPIC_STATION_STOPPING() { return "firefm-station-stopping"; },
  get TOPIC_STATION_ERROR() { return "firefm-station-error"; },

  // Station errors.
  get ERROR_NOT_FOUND() { return 0; },
  get ERROR_INVALID_STATION() { return 1; },
  get ERROR_COMMUNICATION_FAILED() { return 2; },
  get ERROR_NO_CONTENT() { return 3; },
  get ERROR_NO_FREE_PLAYS() { return 4; },
  get ERROR_NO_SUBSCRIPTION() { return 5; },
  get ERROR_SERVICE_OFFLINE() { return 6; },

  // station types.
  get TYPE_ARTIST() { return 0; },
  get TYPE_RECOMMENDED() { return 1; },
  get TYPE_USER() { return 2; },
  get TYPE_TAG() { return 3; },
  get TYPE_NEIGHBORHOOD() { return 4; },

  /* Logger for this object. */
  _logger : null,
  /* The StationInfo object that represents the current station. */
  _currentStation : null,
  /* Flag that indicates that a station is being searched for. */
  _isSearchingStation : false,
  /* Flag that indicates that a station is being loaded. */
  _isLoadingStation : false,

  /**
   * Initializes this object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFM.Station");
    this._logger.debug("init");
    FireFM.obsService.addObserver(this, TOPIC_QUIT_APPLICATION, false);
    FireFM.obsService.addObserver(
      this, FireFM.Login.TOPIC_USER_AUTHENTICATION, false);
  },

  /**
   * Gets the current (or last played) station.
   * @return the current (or last played) station.
   */
  get station() {
    this._logger.debug("[getter] station");

    return this._currentStation;
  },

  /**
   * Sets the station with the given type and id.
   * @param aStationId the id of the station to set.
   * @param aStationType the type of station.
   */
  setStation : function(aStationId, aStationType) {
    this._logger.debug("setStation");

    if ((null == aStationId) || (this.TYPE_ARTIST > aStationType) ||
        (((this.TYPE_RECOMMENDED == aStationType) ||
          (this.TYPE_NEIGHBORHOOD == aStationType)) &&
         (aStationId != FireFM.Login.userName))) {
      this._logger.error(
        "setStation. Error setting station. Station id: " + aStationId +
        ", station type: " + aStationType);
      FireFM.obsService.notifyObservers(
        null, this.TOPIC_STATION_ERROR, this.ERROR_INVALID_STATION);
    } else {
      this._currentStation =
        new FireFM.StationInfo(aStationId, aStationType);
      FireFM.obsService.notifyObservers(
        this._currentStation, this.TOPIC_STATION_SET, null);
    }
  },

  /**
   * Indicates that a station is being loaded.
   * @return true if a station is being loaded, false otherwise.
   */
  get isLoadingStation() {
    this._logger.debug("[getter] isLoadingStation");

    return this._isLoadingStation;
  },

  /**
   * Indicates that a station is being searched for.
   * @return true if a station is being  searched for, false otherwise.
   */
  get isSearchingStation() {
    this._logger.debug("[getter] isSearchingStation");

    return this._isSearchingStation;
  },

  /**
   * Verifies the station information entered by the user against Last.FM.
   * @param aId the ID of the station.
   * @param aType the type of the station.
   * @param aCallback the callback function provided by the caller.
   */
  verifyStation : function(aId, aType, aCallback) {
    this._logger.debug("verifyStation");

    let that = this;

    this._isSearchingStation = true;
    FireFM.obsService.notifyObservers(
      null, FireFM.Station.TOPIC_STATION_SEARCHING, aId);

    switch (aType) {
      case this.TYPE_ARTIST:
        FireFM.Remote.artistSearch(
          aId,
          function(aResult) {
            that._verifyStationLoad(aResult, aType, aCallback); });
        break;
      case this.TYPE_TAG:
        FireFM.Remote.tagSearch(
          aId,
          function(aResult) {
            that._verifyStationLoad(aResult, aType, aCallback); });
        break;
      default:
        // we don't verify the other stations, so we call the handler directly.
        this._verifyStationLoad(
          { success : true, result : aId }, aType, aCallback);
        break;
    }
  },

  /**
   * Load handler for the verify station request.
   * @param aResult the resulting object from the request. See
   * FireFM.Remote.verifyStation for more information.
   * @param aType the type of station to load.
   * @param aCallback the callback function provided by the caller.
   */
  _verifyStationLoad : function(aResult, aType, aCallback) {
    this._logger.debug("_verifyStationLoad");

    if (this._isSearchingStation) {
      this._isSearchingStation = false;
      aCallback(aResult, aType);
    }
  },

  /**
   * Plays the currently selected station.
   */
  play : function() {
    this._logger.debug("play");

    if (null == this._currentStation) {
      this._logger.error("play. No station selected!");
      throw new Ce("No station selected when play was called.");
    }

    this.stop();

    // set loading state.
    this._isLoadingStation = true;
    FireFM.obsService.notifyObservers(
      this._currentStation, this.TOPIC_STATION_LOADING, null);

    // load music player.
    if (null == FireFM.PlayerInitializer) {
      Components.utils.import("resource://firefm/fmPlayerInitializer.js");
    }

    // tune the station if everything works.
    FireFM.PlayerInitializer.initializePlayer(
      function() { FireFM.Remote.tuneRadio(); });
  },

  /**
   * Stops playback on the current station.
   */
  stop : function() {
    this._logger.debug("stop");
    FireFM.obsService.notifyObservers(
      this._currentStation, this.TOPIC_STATION_STOPPING, null);

    try {
      this._isLoadingStation = false;
      this._isSearchingStation = false;
      FireFM.Player.stop();
      FireFM.Remote.scrobbleTrack();
      FireFM.Playlist.clearPlaylist();
    } catch (e) {
      this._logger.error("stop. Error trying to stop player:\n" + e);
    }
  },

  /**
   * Skips to the next track in the playlist.
   */
  skip : function() {
    this._logger.debug("skip");

    FireFM.Remote.skipTrack();

    if (FireFM.Playlist.hasMoreTracks()) {
      try {
        FireFM.Player.play();
      } catch (e) {
        this._logger.error("skip. Error playing next track:\n" + e);
      }
    } else {
      try {
        this.stop();
        this.play();
      } catch (e) {
        this._logger.error("skip. Error restarting station:\n" + e);
      }
    }
  },

  /**
   * Load callback handler for the get playlist request.
   * @param aDocument the XML document that contains the playlist. Can be null
   * in case of error.
   */
  loadPlaylist : function(aDocument) {
    this._logger.debug("loadPlaylist");

    if (this._isLoadingStation) {
      this._isLoadingStation = false;

      if (null != aDocument) {
        try {
          try {
            FireFM.Playlist.setNewPlaylist(aDocument);
          } catch (e) {
            this._logger.error(
              "loadPlaylist. Invalid data received: " + aDocument +
              "\n Error: " + e);
            FireFM.obsService.notifyObservers(
              null, this.TOPIC_STATION_ERROR, this.ERROR_NO_CONTENT);
          }

          if (FireFM.Playlist.hasMoreTracks()) {
            FireFM.obsService.notifyObservers(
              this._currentStation, this.TOPIC_STATION_OPENING, null);
            FireFM.Player.play();
          } else {
            FireFM.obsService.notifyObservers(
              null, this.TOPIC_STATION_ERROR, this.ERROR_NO_CONTENT);
          }
        } catch (e) {
          this._logger.error(
            "loadPlaylist. Error playing playlist.\n Error: " + e);
          FireFM.obsService.notifyObservers(
            null, this.TOPIC_STATION_ERROR, this.ERROR_COMMUNICATION_FAILED);
        }
      } else {
        FireFM.obsService.notifyObservers(
          this._currentStation, this.TOPIC_STATION_ERROR,
          this.ERROR_NO_CONTENT);
      }
    } else {
      this._logger.warn("loadPlaylist. Load cancelled by user.");
      FireFM.Playlist.clearPlaylist();
    }
  },

  /**
   * Observes notifications of cookie and track activity.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data related to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    if ((TOPIC_QUIT_APPLICATION == aTopic) ||
       ((FireFM.Login.TOPIC_USER_AUTHENTICATION == aTopic) &&
        (null == aData))) {
      this.stop();
    }
  }
};

/**
 * FireFM.Station constructor.
 */
(function() {
  this.init();
}).apply(FireFM.Station);
