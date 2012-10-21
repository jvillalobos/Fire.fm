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

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmEntities.js");
Components.utils.import("resource://firefm/fmPlayer.js");

// Last.FM feed URLs. Note that the array *must* be ordered by type.
const URL_BASE = "http://ws.audioscrobbler.com/1.0";
const URL_USER_BASE = URL_BASE + "/user/$(USER)";
const URL_ARTIST_BASE = URL_BASE + "/artist/$(ARTIST)";

const URLS_FEEDS =
  [ URL_USER_BASE + "/friends.xml",
    URL_USER_BASE + "/neighbours.xml",
    URL_USER_BASE + "/topartists.xml",
    URL_ARTIST_BASE + "/similar.xml" ];

/**
 * Handles the parsing and temporary storage of feed data, such as top artists,
 * friend lists, etc.
 */
FireFM.Feeds = {
  // Topic notifications sent from this object.
  get TOPIC_FEED_LOADED()  { return "firefm-feed-loaded";  },
  get TOPIC_FEED_CLEARED() { return "firefm-feed-cleared"; },

  // Feed types.
  get FEED_FRIENDS() { return 0; },
  get FEED_NEIGHBORS() { return 1; },
  get FEED_TOP_ARTISTS() { return 2; },
  get FEED_SIMILAR_ARTISTS() { return 3; },

  /* Logger for this object. */
  _logger : null,

  /* User feeds matrix. Holds all data gathered from user feeds. */
  _feeds : new Array(),

  /**
   * Returns the amount of feeds we handle.
   * @param the amount of feeds we handle.
   */
  get _feedCount() { return URLS_FEEDS.length; },

  /**
   * Obtains the feed of the given type, restricted to the given limit of items.
   * @param aFeedType the type of the feed to get. It can be any of the FEED_
   * constants in this object.
   * @param aLimit the limit of data items in the feed. If the feed has more
   * data items than aLimit, the feed is cropped at the end. It should be -1 for
   * no limit.
   * @return array with the feed data.
   */
  getFeed : function(aFeedType, aLimit) {
    this._logger.debug("getFeed");

    if (("number" != typeof(aFeedType)) || (0 > aFeedType) ||
        (this._feedCount <= aFeedType) || ("number" != typeof(aLimit))) {
      this._logger.error(
        "getFeed. Invalid feed type or limit. Type: " + aFeedType +
        ", limit: " + aLimit);
      throw new Ce("Invalid feed type or limit.");
    }

    let feed =
      ((0 <= aLimit) ? this._feeds[aFeedType].slice(0, aLimit) :
       this._feeds[aFeedType]);

    return feed;
  },

  /**
   * Obtains the size feed of the given type.
   * @param aFeedType the type of the feed to get. It can be any of the FEED_
   * constants in this object.
   * @return the amount of items on the specified feed.
   */
  getFeedSize : function(aFeedType) {
    this._logger.debug("getFeedSize");

    if (("number" != typeof(aFeedType)) || (0 > aFeedType) ||
        (this._feedCount <= aFeedType)) {
      this._logger.error("getFeedSize. Invalid feed type. Type: " + aFeedType);
      throw new Ce("Invalid feed type.");
    }

    return this._feeds[aFeedType].length;
  },

  /**
   * Sends a request for the specified feed type.
   * @param aFeedType the type of the feed to fetch.
   */
  fetchFeed : function(aFeedType) {
    this._logger.debug("fetchFeed");

    if (("number" != typeof(aFeedType)) || (0 > aFeedType) ||
        (this._feedCount <= aFeedType)) {
      this._logger.error("fetchFeed. Invalid feed type: " + aFeedType);
      throw new Ce("Invalid feed type.");
    }

    let userName = encodeURIComponent(FireFM.Login.userName);
    let artist = "";
    if (null != FireFM.Player.track) {
      artist = encodeURIComponent(FireFM.Player.track.artist);
    }

    let url = URLS_FEEDS[aFeedType];
    let that = this;

    // check that the feed exists.
    if (null != url) {
      url = url.replace(/\$\(USER\)/, userName);
      url = url.replace(/\$\(ARTIST\)/, artist);
      // delete the data.
      FireFM.Remote.fetchFeed(
        url, function(aResponse) { that._parseFeed(aFeedType, aResponse); });
    }
  },

  /**
   * Clears the feed of the specified types.
   * @param aFeedType the type of the feed to clear.
   */
  _clearFeed : function(aFeedType) {
    this._logger.trace("_clearFeed");

    // check that the feed is valid.
    if (null != URLS_FEEDS[aFeedType]) {
      let feedData = this._feeds[aFeedType];
      // delete the data.
      feedData.splice(0, feedData.length);

      FireFM.obsService.notifyObservers(
        null, this.TOPIC_FEED_CLEARED, aFeedType);
    }
  },

  /**
   * Parses the feed data received from the Last.fm server.
   * @param aFeedType the type of feed being parsed.
   * @param aResponse the XMLHTTPRequest object that holds the response data.
   */
  _parseFeed : function(aFeedType, aResponse) {
    this._logger.trace("_parseFeed. Type: " + aFeedType);

    if (null != aResponse) {
      let feed = this._feeds[aFeedType];
      let doc = aResponse.responseXML;
      let listItems = doc.documentElement.childNodes;
      let itemCount = listItems.length;
      let isArtistFeed =
        (this.FEED_TOP_ARTISTS == aFeedType ||
         this.FEED_SIMILAR_ARTISTS == aFeedType);
      let listItem, name, url, imagePath;

      this._clearFeed(aFeedType);

      for (let i = 0; i < itemCount; i++) {
        listItem = listItems[i];

        if (Ci.nsIDOMNode.ELEMENT_NODE == listItem.nodeType) {
          if (isArtistFeed) {
            name = listItem.getElementsByTagName("name")[0].textContent;
          } else {
            name = listItem.getAttribute("username");
          }

          url = listItem.getElementsByTagName("url")[0].textContent;
          imagePath = listItem.getElementsByTagName("image")[0].textContent;
          feed.push(new FireFM.FeedItem(name, url, imagePath));
        }
      }

      FireFM.obsService.notifyObservers(
        null, this.TOPIC_FEED_LOADED, aFeedType);
    } else {
      this._logger.error("_parseFeed. No response.");
    }
  },

  /**
   * Observes notifications of authentication.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data related to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    switch (aTopic) {

      case FireFM.Player.TOPIC_TRACK_LOADED:
        this._clearFeed(this.FEED_SIMILAR_ARTISTS);
        this.fetchFeed(this.FEED_SIMILAR_ARTISTS);
        break;

      case FireFM.Player.TOPIC_PLAYER_STOPPED:
        this._clearFeed(this.FEED_SIMILAR_ARTISTS);
        break;

      case FireFM.Login.TOPIC_USER_AUTHENTICATION:
        if (null != aData) {
          this.fetchFeed(this.FEED_FRIENDS);
          this.fetchFeed(this.FEED_NEIGHBORS);
          this.fetchFeed(this.FEED_TOP_ARTISTS);
        } else {
          this._clearFeed(this.FEED_FRIENDS);
          this._clearFeed(this.FEED_NEIGHBORS);
          this._clearFeed(this.FEED_TOP_ARTISTS);
        }

        break;
    }
  }
};

/**
 * FireFM.Feeds constructor.
 */
(function() {
  let feedCount = URLS_FEEDS.length;

  this._logger = FireFM.getLogger("FireFM.Feeds");
  this._logger.debug("init");

  // initialize the feed array to empty data.
  for (let type = 0; type < this._feedCount; type++) {
    this._feeds[type] = new Array();
  }

  FireFM.obsService.addObserver(
    this, FireFM.Login.TOPIC_USER_AUTHENTICATION, false);
  FireFM.obsService.addObserver(
    this, FireFM.Player.TOPIC_TRACK_LOADED, false);
  FireFM.obsService.addObserver(
    this, FireFM.Player.TOPIC_PLAYER_STOPPED, false);
}).apply(FireFM.Feeds);
