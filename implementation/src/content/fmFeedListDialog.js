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

Components.utils.import("resource://firefm/fmCommon.js");

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/**
 * Feed list dialog controller.
 */
FireFMChrome.FeedListDialog = {
  /* Logger for this object. */
  _logger : null,
  /* The full feed list. */
  _feed : null,

  /**
   * Initializes the object.
   */
  init : function() {
    let message;

    this._logger = FireFM.getLogger("FireFMChrome.FeedListDialog");
    this._logger.debug("init");

    document.documentElement.getButton("accept").disabled = true;

    message = document.getElementById("message");
    document.title = window.arguments[1];
    message.value = window.arguments[2];
    this._loadFeed(window.arguments[0]);
    document.getElementById("feed-list").focus();
  },

  /**
   * Loads the feed into the list.
   * @param aFeedType the type of feed to load.
   */
  _loadFeed : function(aFeedType) {
    this._logger.trace("_loadFeed");

    let list = document.getElementById("feed-list");
    let feedSize;
    let listItem;
    let image;
    let itemName;

    this._feed = FireFM.Feeds.getFeed(aFeedType, -1);
    feedSize = this._feed.length;

    for (let i = 0; i < feedSize; i++) {
      listItem = document.createElement("richlistitem");
      image = document.createElement("image");
      image.setAttribute("class", "firefm-feed-image");
      image.setAttribute("src", this._feed[i].imagePath);
      itemName = document.createElement("label");
      itemName.setAttribute("value", this._feed[i].name);
      listItem.appendChild(image);
      listItem.appendChild(itemName);
      list.appendChild(listItem);
    }
  },

  /**
   * Triggered when the user clicks on the accept button.
   * @param aEvent the event that triggered this.
   */
  accept : function(aEvent) {
    this._logger.debug("accept");

    let list = document.getElementById("feed-list");

    window.arguments[3].selected = this._feed[list.selectedIndex];
  },

  /**
   * Triggered when the user clicks on the cancel button.
   * @param aEvent the event that triggered this.
   */
  cancel : function(aEvent) {
    this._logger.debug("cancel");
    window.arguments[3].selected = null;
  },

  /**
   * Triggered when the user clicks selects an item on the list.
   * @param aEvent the event that triggered this.
   */
  onSelect : function(aEvent) {
    this._logger.debug("onSelect");

    let list = document.getElementById("feed-list");

    document.documentElement.getButton("accept").disabled =
      (0 > list.selectedIndex);
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.FeedListDialog.init(); }, false);
