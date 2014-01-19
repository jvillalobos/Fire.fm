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

// Max width and height values for the Fire.fm album images
const FIREFM_ALBUM_MAXWIDTH  = 64;
const FIREFM_ALBUM_MAXHEIGHT = 64;
// Regular expression used to determine if this is a Fire.fm notification
const FIREFM_TITLE_REGEX = /fire\.fm/gi;

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Alert overlay. Fixes a few UI issues with the Windows alert window.
 */
FireFMChrome.AlertOverlay = {
  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the object.
   */
  onAlertLoad : function() {
    this._logger = FireFM.getLogger("FireFMChrome.AlertOverlay");
    this._logger.debug("onAlertLoad");

    let title = String(window.arguments[1]);
    if (title.match(FIREFM_TITLE_REGEX)) {

      // Set album image style properties
      let image = document.getElementById("alertImage");
      image.setAttribute("maxwidth", FIREFM_ALBUM_MAXWIDTH);
      image.setAttribute("maxheight", FIREFM_ALBUM_MAXHEIGHT);
      image.style.maxWidth = FIREFM_ALBUM_MAXWIDTH + "px";
      image.style.maxHeight = FIREFM_ALBUM_MAXHEIGHT + "px";
      image.style.width = FIREFM_ALBUM_MAXWIDTH + "px";
      image.style.height = FIREFM_ALBUM_MAXHEIGHT + "px";
      image.style.margin = "4px";

      this._breakTextLabels();
    }

    onAlertLoad();
  },

  /**
   * Finds line breaks (\n) in the alert text and creates a separate label for
   * each of the text lines.
   */
  _breakTextLabels : function() {
    this._logger.trace("_breakTextLabels");

    document.getElementById("alertTextLabel").hidden = true;

    try {
      let labelsBox = document.getElementById("alertTextBox");
      let labelString = window.arguments[2];
      let clickable = window.arguments[3];
      let labels = labelString.split("\n");

      for (var i = 0; i < labels.length; i++) {
        let label = document.createElement("label");
        label.setAttribute("value", labels[i]);
        label.setAttribute("class", "alertText plain");
        label.setAttribute("clickable", clickable);
        label.setAttribute("onclick", "onAlertClick();");
        labelsBox.appendChild(label);
      }
    } catch (e) {
      this._logger.warn("_breakTextLabels failed: " + e);
    }
  }
};
