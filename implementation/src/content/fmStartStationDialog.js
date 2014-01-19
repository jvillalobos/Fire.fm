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

Components.utils.import("resource://firefm/fmCommon.js");

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Start station dialog controller.
 */
FireFMChrome.StartStationDialog = {

  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFMChrome.StartStationDialog");
    this._logger.debug("init");

    // set the document title.
    if (FireFM.OS_MAC == FireFM.getOperatingSystem()) {
      let titleElem = document.getElementById("info.title");

      titleElem.value =
        FireFM.overlayBundle.GetStringFromName("firefm.startAStation.label");
      titleElem.hidden = false;
    } else {
      document.title =
        FireFM.overlayBundle.GetStringFromName("firefm.startAStation.label");
    }

    getAttention();
  },

  setStation : function() {
    this._logger.debug("setStation");

    let tabbox = document.getElementById("fm-start-station-tabs");
    let returnObj = window.arguments[0];

    switch (tabbox.selectedIndex) {
      case 0:
        returnObj.type = FireFM.Station.TYPE_ARTIST;
        returnObj.value =
          document.getElementById("start-station-input-artist").value;
        break;
      case 1:
        returnObj.type = FireFM.Station.TYPE_TAG;
        returnObj.value =
          document.getElementById("start-station-input-tag").value;
        break;
      case 2:
        returnObj.type = FireFM.Station.TYPE_USER;
        returnObj.value =
          document.getElementById("start-station-input-user").value;
        break;
    }
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.StartStationDialog.init(); }, false);
