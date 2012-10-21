/**
 * Copyright (c) 2009-2010, Jose Enrique Bolanos, Jorge Villalobos
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

const TOPIC_PRIVATE_BROWSING = "private-browsing";

/**
 * FireFM Private Mode handler.
 */
FireFM.Private = {

  /* Logger for this object. */
  _logger : null,
  /* Private browsing service. */
  _privateService : null,
  /* Flag that indicates the current private mode state. */
  _isPrivateMode : false,
  /* Private mode preference object. */
  _privateModePref : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFM.Private");
    this._logger.debug("init");

    try {
      this._privateService =
        Cc["@mozilla.org/privatebrowsing;1"].
          getService(Ci.nsIPrivateBrowsingService);
      this._isPrivateMode = this._privateService.privateBrowsingEnabled;

      FireFM.obsService.addObserver(this, TOPIC_PRIVATE_BROWSING, false);
    } catch (e) {
      this._logger.info("init. Private browsing not supported.");
    }

    // get the preference value.
    this._privateModePref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "enablePrivateMode");
  },

  /**
   * Indicates if the browser is in private mode AND the preference is set to
   * enable private mode.
   * @return true if private mode needs to be enforced, false otherwise.
   */
  get isPrivate() {
    this._logger.trace("[getter] isPrivate");

    return (this._isPrivateMode && this._privateModePref.value);
  },

  /**
   * Observes topic notifications.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data relating to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    if (TOPIC_PRIVATE_BROWSING == aTopic) {
      FireFM.Station.stop();
      this._isPrivateMode = ("enter" == aData);

      if (!this._isPrivateMode && this._privateModePref.value &&
          ("undefined" == typeof(FireFM.History))) {
        let lastStation = FireFM.History.stationHistory[0];

        // reset the last played station.
        if (lastStation) {
          FireFM.Station.setStation(lastStation.id, lastStation.type);
        }
      }
    }
  }
};

/**
 * FireFM.Private constructor.
 */
(function() {
  this.init();
}).apply(FireFM.Private);
