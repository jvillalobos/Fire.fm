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
Components.utils.import("resource://gre/modules/Microformats.js");

/**
 * Detects audio microformats on web pages.
 */
FireFM.Microformats = {
  /* Logger for this object. */
  _logger : null,

  /**
   * Gets all audio microformats present in the document.
   * @param aDocument the document to extract the microformats from.
   * @return the array of microformats that were found.
   */
  getAudioMicroformats : function(aDocument) {
    if (null == this._logger) {
      this._logger = FireFM.getLogger("FireFM.Microformats");
    }

    this._logger.debug("getAudioMicroformats");

    return Microformats.get("hAudio", aDocument);
  }
};

/**
 * hAudio microformat.
 */
if (typeof(hAudio) == 'undefined') {

  function hAudio(node) {
    if (node) {
      Microformats.parser.newMicroformat(this, node, "hAudio");
    }
  }

  hAudio.prototype.toString = function() {
    return this.title;
  }

  var hAudio_definition = {
    mfVersion: 0.9,
    description: "Audio",
    mfObject: hAudio,
    className: "haudio",
    properties: {
      "title" : {
      },
      "album" : {
      },
      "item" : {
      },
      "position" : {
      },
      "contributor" : {
        datatype: "microformat",
        microformat: "hCard"
      },
      "published" : {
      },
      "sample" : {
        rel : true,
        datatype : "custom",
        customGetter : function(aPropNode) {
          return aPropNode.getAttribute("href");
        }
      },
      "enclosure" : {
        rel : true,
        datatype : "custom",
        customGetter : function(aPropNode) {
          return aPropNode.getAttribute("href");
        }
      },
      "payment" : {
      },
      "photo" : {
        datatype : "custom",
        customerGetter : function(aPropNode) {
          return aPropNode.getAttribute("src");
        }
      },
      "category" : {
        rel : true,
        datatype : "microformat",
        microformat : "tag"
      },
      "duration" : {
      },
      "price" : {
      },
      "description" : {
      }
    }
  }
}

/**
 * Registers the microformat.
 */
(function() {
  Microformats.add("hAudio", hAudio_definition);
}).apply(hAudio);
