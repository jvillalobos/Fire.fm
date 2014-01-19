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

/**
 * This object manages the lists of feeds on the toolbar and menu.
 */
FireFMChrome.Feeds = {
  /* The maximum amount of items to be shown on a popup. */
  _MAX_ITEM_COUNT : 15,
  // Topic notifications sent from the Feeds object.
  _TOPIC_FEED_LOADED : "firefm-feed-loaded",
  _TOPIC_FEED_CLEARED : "firefm-feed-cleared",

  /* Ids for elements where the feed items will be added. */
  _FEEDS :
    [ [ "firefm-mm-station-friends", "firefm-tb-station-friends",
        "firefm-status-tb-station-friends" ],
      [ "firefm-mm-station-neighbors", "firefm-tb-station-neighbors",
        "firefm-status-tb-station-neighbors" ],
      [ "firefm-mm-station-top-artists", "firefm-tb-station-top-artists",
        "firefm-status-tb-station-top-artists" ],
      [ "firefm-mm-station-similar-artists",
        "firefm-tb-station-similar-artists",
        "firefm-status-tb-station-similar-artists" ] ],

  /* Logger for this object. */
  _logger : null,
  /* menuitem element used to show the full list for a cut feed. */
  _fullListItem : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFMChrome.Feeds");
    this._logger.debug("init");

    // generate the 'full list' menu item.
    this._fullListItem = document.createElement("menuitem");
    this._fullListItem.setAttribute("observes", "firefm-full-list-broadcaster");

    // set all feeds to empty.
    this._clearAllFeeds();

    // try to load all feeds in case this is not the first window being opened.
    if (null != FireFM.Login.userName) {
      this._loadFeed(FireFM.Feeds.FEED_SIMILAR_ARTISTS);
      this._loadFeed(FireFM.Feeds.FEED_TOP_ARTISTS);
      this._loadFeed(FireFM.Feeds.FEED_FRIENDS);
      this._loadFeed(FireFM.Feeds.FEED_NEIGHBORS);
    }

    // add observers.
    FireFM.obsService.addObserver(this, this._TOPIC_FEED_LOADED, false);
    FireFM.obsService.addObserver(this, this._TOPIC_FEED_CLEARED, false);
  },

  /**
   * Unloads the object.
   */
  uninit : function() {
    this._logger.debug("uninit");
    // remove observers.
    FireFM.obsService.removeObserver(this, this._TOPIC_FEED_LOADED);
    FireFM.obsService.removeObserver(this, this._TOPIC_FEED_CLEARED);
  },

  /**
   * Loads the feed of the specified type into the corresponding elements.
   * @param aFeedType the type of feed that will be loaded.
   */
  _loadFeed : function(aFeedType) {
    this._logger.debug("_loadFeed. Type: " + aFeedType);

    let elementIds = this._FEEDS[aFeedType];
    let idCount = elementIds.length;

    if (0 < idCount) {
      let isMac = (FireFM.OS_MAC == FireFM.getOperatingSystem());
      let elements = new Array();
      let elementCount;
      let element;

      for (let i = 0; i < idCount; i++) {
        element = document.getElementById(elementIds[i]);

        if (null != element) {
          elements.push(element);
        }
      }

      elementCount = elements.length;

      if (0 < elementCount) {
        let feed = FireFM.Feeds.getFeed(aFeedType, this._MAX_ITEM_COUNT);
        let feedItemCount = feed.length; // limited.

        if (0 < feedItemCount) {
          let popup = document.createElement("menupopup");
          let feedSize = FireFM.Feeds.getFeedSize(aFeedType); // total.
          let feedItem;
          let menuItem;

          // build the menupopup with all the corresponding feed items.
          for (let i = 0; i < feedItemCount; i++) {
            feedItem = feed[i];
            menuItem = document.createElement("menuitem");

            menuItem.setAttribute("label", feedItem.name);
            menuItem.setAttribute("fmurl", feedItem.url);

            // XXX: don't use icon images on Mac because they're buggy and
            // causing crashes.
            if (!isMac) {
              menuItem.setAttribute(
                "class", "menuitem-iconic firefm-menuitem-iconic");
              menuItem.setAttribute("image", feedItem.imagePath);
            }

            popup.appendChild(menuItem);
          }

          // if the feed items were cut, add an item to show the full list.
          if (feedSize > feedItemCount) {
            menuItem = document.createElement("menuseparator");
            popup.appendChild(menuItem);
            popup.appendChild(this._fullListItem.cloneNode(true));
          }

          // add the menu popup to all associated elements.
          for (let i = 0; i < elementCount; i++) {
            element = elements[i];

            if (null != element.firstChild) {
              // remove the menupopup to clear all existing elements.
              element.removeChild(element.firstChild);
            }

            element.appendChild((0 == i) ? popup : popup.cloneNode(true));
          }
        }
      }
    }
  },

  /**
   * Clears all feeds.
   */
  _clearAllFeeds : function() {
    this._logger.trace("_clearAllFields");

    for (let i = 0; i < this._FEEDS.length; i++) {
      this._clearFeed(i);
    }
  },

  /**
   * Clears the feed of the given type.
   * @param aFeedType The type of the feed to clear.
   */
  _clearFeed : function(aFeedType) {
    this._logger.trace("_clearFeed");

    let feed = this._FEEDS[aFeedType];
    let menu;
    let menuItem;
    let popup;

    for (let i = 0; i < feed.length; i++) {
      menu = document.getElementById(feed[i]);

      if (null != menu) {
        if (null != menu.firstChild) {
          // remove the menupopup to clear all elements.
          menu.removeChild(menu.firstChild);
        }

        // add a popup with an Empty menu item.
        popup = document.createElement("menupopup");
        menuItem = document.createElement("menuitem");
        menuItem.setAttribute(
          "label",
          FireFM.overlayBundle.GetStringFromName("firefm.emptyMenu.label"));
        menuItem.setAttribute("disabled", true);
        popup.appendChild(menuItem);
        menu.appendChild(popup);
      }
    }
  },

  /**
   * Opens a dialog with the full list from the feed, allowing the user to
   * choose one item from it. When the user chooses an item, the corresponding
   * action (such as opening a station) is run.
   * @param aEvent the event that triggered this.
   */
  showFullList : function(aEvent) {
    this._logger.debug("showFullList");

    let listResult = { selected : null };
    let elementId = aEvent.target.parentNode.parentNode.id;
    let feedType;
    let title;
    let message;

    switch (elementId) {
      case "firefm-mm-station-similar-artists":
      case "firefm-tb-station-similar-artists":
      case "firefm-status-tb-station-similar-artists":
        title =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.artistTitle.label");
        message =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.artist.label");
        feedType = FireFM.Feeds.FEED_SIMILAR_ARTISTS;
        break;
      case "firefm-mm-station-top-artists":
      case "firefm-tb-station-top-artists":
      case "firefm-status-tb-station-top-artists":
        title =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.artistTitle.label");
        message =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.artist.label");
        feedType = FireFM.Feeds.FEED_TOP_ARTISTS;
        break;
      case "firefm-mm-station-friends":
      case "firefm-tb-station-friends":
      case "firefm-status-tb-station-friends":
        title =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.friendTitle.label");
        message =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.friend.label");
        feedType = FireFM.Feeds.FEED_FRIENDS;
        break;
      case "firefm-mm-station-neighbors":
      case "firefm-tb-station-neighbors":
      case "firefm-status-tb-station-neighbors":
        title =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.neighborTitle.label");
        message =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.fullList.neighbor.label");
        feedType = FireFM.Feeds.FEED_NEIGHBORS;
        break;
    }

    window.openDialog(
      "chrome://firefm/content/fmFeedListDialog.xul", "firefm-feed-list-dialog",
      "chrome,modal,centerscreen,titlebar,toolbar,resizable=no", feedType,
      title, message, listResult);

    if (null != listResult.selected) {
      switch (feedType) {
        case FireFM.Feeds.FEED_SIMILAR_ARTISTS:
        case FireFM.Feeds.FEED_TOP_ARTISTS:
          FireFMChrome.BrowserOverlay.verifyStation(
            listResult.selected.name, FireFM.Station.TYPE_ARTIST);
          break;
        case FireFM.Feeds.FEED_FRIENDS:
        case FireFM.Feeds.FEED_NEIGHBORS:
          FireFM.Station.setStation(
            listResult.selected.name, FireFM.Station.TYPE_USER);
          FireFM.Station.play();
          break;
      }
    }
  },

  /**
   * Observes topic notifications.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data relating to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    if (this._TOPIC_FEED_LOADED == aTopic) {
      this._loadFeed(parseInt(aData));
    } else if (this._TOPIC_FEED_CLEARED == aTopic) {
      this._clearFeed(parseInt(aData));
    }
  }
};
