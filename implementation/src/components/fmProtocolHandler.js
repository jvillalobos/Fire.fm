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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Ce = Components.Exception;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Regular expression for the stations (station/type/id).
const STATION_REGEX = /^firefm:(?:\/\/)?station\/([^\/]+)\/([^\/]+)/i;

/**
 * Handles the firefm protocol
 */
function fmProtocolHandler() {
}

fmProtocolHandler.prototype = {
  // XPCOM stuff.
  classID : Components.ID("{AE6C9422-FB46-4C0A-86D2-9C10A2E9B5CB}"),
  classDescription : "Fire.fm protocol",
  contractID : "@mozilla.org/network/protocol;1?name=firefm",

  scheme : "firefm",

  defaultPort : -1,

  protocolFlags :
    (Ci.nsIProtocolHandler.URI_NORELATIVE | Ci.nsIProtocolHandler.URI_NOAUTH),

  allowPort: function(port, scheme) {
    return false;
  },

  newURI : function(aSpec, aCharset, aBaseURI) {
    let uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;

    return uri;
  },

  newChannel : function(aInputURI) {
    let ioService =
      Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let regexResult = STATION_REGEX.exec(aInputURI.spec);

    if (regexResult && (3 == regexResult.length)) {
      let win =
        Cc['@mozilla.org/appshell/window-mediator;1'].
          getService(Ci.nsIWindowMediator).
            getMostRecentWindow("navigator:browser");

      let stationObj = win.FireFM.Station;
      let id = regexResult[2];

      switch (regexResult[1]) {
        case "artist":
          win.FireFMChrome.BrowserOverlay.verifyStation(
            id, stationObj.TYPE_ARTIST);
          break;
        case "user":
          win.FireFMChrome.BrowserOverlay.verifyStation(
            id, stationObj.TYPE_USER);
          break;
        case "tag":
          win.FireFMChrome.BrowserOverlay.verifyStation(
            id, stationObj.TYPE_TAG);
          break;
        case "recommended":
          stationObj.setStation(id, stationObj.TYPE_RECOMMENDED);
          stationObj.play();
          break;
        case "neighborhood":
          stationObj.setStation(id, stationObj.TYPE_NEIGHBORHOOD);
          stationObj.play();
          break;
      }
    }

    // XXX: Return "javascript:" to satisfy the method signature without
    // not actually loading anything in the browser.
    return ioService.newChannel("javascript:", null, null);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler])
};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([ fmProtocolHandler ]);
} else {
    var NSGetModule = XPCOMUtils.generateNSGetModule([ fmProtocolHandler ]);
}
