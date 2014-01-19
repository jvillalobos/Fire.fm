/**
 * Copyright (c) 2014, Jose Enrique Bolanos, Jorge Villalobos
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

// NoScript service name.
const NOSCRIPT_SERVICE = "@maone.net/noscript-service;1";

/**
 * FireFM Player Initializer. Performs all the player intialization tasks.
 */
FireFM.PlayerInitializer = {

  /* Logger for this object */
  _logger : null,
  /* The hidden window that will hold the player. */
  _hiddenWin : null,
  /* Holds the exception that may have been thrown during initialization */
  _initializationException : null,
  /* Preference object that holds the current volume setting. */
  _volumePref : null,

  /**
   * Initializes the object.
   */
  init : function() {
    let that = this;

    this._logger = FireFM.getLogger("FireFM.PlayerInitializer");
    this._logger.debug("init");
    this._volumePref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "volumeLevel");
  },

  /**
   * Obtains the exception that may have been thrown during player
   * initialization. Null if no exception was thrown.
   */
  get initializationException() {
    this._logger.debug("initializationException[get]");
    return this._initializationException;
  },

  /**
   * Initializes the audio object needed to play mp3 files.
   * @param aCallback the function to call once the player has been initialized.
   */
  initializePlayer : function(aCallback) {
    this._logger.debug("initializePlayer");

    let app =
      Cc["@mozilla.org/appshell/appShellService;1"].
        getService(Ci.nsIAppShellService);

    try {
      // test error line. Comment out on releases!
      //null.hello;
      this._hiddenWin = app.createWindowlessBrowser(true);
      this._hiddenWin.loadURI(
        "chrome://firefm/content/fmAudio.html",
        Ci.nsIWebNavigation.LOAD_FLAGS_NONE, null, null, null);
      // check if the player has loaded correctly.
      this._testPlayer(1, aCallback);
    } catch (e) {
      this._logger.fatal("_initializePlayer. Initialization failed:\n" + e);
      this._initializationException = e;
      FireFM.obsService.notifyObservers(
        null, FireFM.Player.TOPIC_PLAYER_ERROR,
        FireFM.Player.STATUS_LOAD_ERROR);
    }
  },

  /**
   * Tests the player object the make sure it loaded correctly.
   * @param aTry the amount of tries for this test. After MAX_TRIES the player
   * is considered to have failed to load.
   * @param aCallback the function to call once the player has been initialized.
   */
  _testPlayer : function(aTry, aCallback) {
    this._logger.trace("_testPlayer");

    const MAX_TRIES = 5;
    const TRY_DELAY = 50;
    let audio = this._hiddenWin.document.getElementById("audio");

    if (null != audio) {
      try {
        if ("" != audio.canPlayType("audio/mp3")) {
          this._logger.info("Player initialized successfully");
          FireFM.Player.setPlayer(audio);
          FireFM.Player.setVolume(this._volumePref.value);
          aCallback();
        } else {
          // XXX: the error message should be less generic in this case.
          this._logger.fatal(
            "_testPlayer. Player startup failed due to no MP3 support");
          FireFM.obsService.notifyObservers(
            null, FireFM.Player.TOPIC_PLAYER_ERROR,
            FireFM.Player.STATUS_LOAD_ERROR);
        }
      } catch (e) {
        this._logger.fatal("_testPlayer. Player startup failed.");
        this._initializationException = e;
        FireFM.obsService.notifyObservers(
          null, FireFM.Player.TOPIC_PLAYER_ERROR,
          FireFM.Player.STATUS_LOAD_ERROR);
      }
    } else {
      if (aTry < MAX_TRIES) {
        let that = this;

        FireFM.runWithDelay(
          function() { that._testPlayer(++aTry, aCallback); }, TRY_DELAY);
      } else {
        this._logger.fatal("_testPlayer. Player testing failed.");
        FireFM.obsService.notifyObservers(
          null, FireFM.Player.TOPIC_PLAYER_ERROR,
          FireFM.Player.STATUS_PLUGIN_FAILED);
      }
    }
  }
};

/**
 * FireFM.PlayerInitializer constructor.
 */
(function() {
  this.init();
}).apply(FireFM.PlayerInitializer);
