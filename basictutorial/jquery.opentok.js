/*
 * OpenTok plugin for jQuery JavaScript Library
 *
 * Copyright (c) 2011, Jose M Torres
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function($){
  if(!$.openTok){
    $.openTok = { };
  }

  $.fn.openTok = function( options ) {
    var name = "openTok";
    var isMethodCall = typeof options === "string",
      args = Array.prototype.slice.call( arguments, 1 ),
      returnValue = this;

    // allow multiple hashes to be passed on init
    options = !isMethodCall && args.length ?
      $.extend.apply( null, [ true, options ].concat(args) ) :
      options;

    // prevent calls to internal methods
    if ( isMethodCall && options.charAt( 0 ) === "_" ) {
      return returnValue;
    }

    if ( isMethodCall ) {
      this.each(function() {
        var instance = $.data( this, name ),
          methodValue = instance && $.isFunction( instance[options] ) ?
            instance[ options ].apply( instance, args ) :
            instance;
        if ( methodValue !== instance && methodValue !== undefined ) {
          returnValue = methodValue;
          return false;
        }
      });
    } else {
      this.each(function() {
        var instance = $.data( this, name );
        if ( instance ) {
          // instance.option( options || {} )._init(); // Orig jquery.ui.widget.js code: Not recommend for openTok. ie., Applying new options to an existing instance (via the openTok constructor) and performing the _init(). The _init() is what concerns me. It would leave a lot of event handlers acting on openTok instance and the interface.
          instance.option( options || {} ); // The new constructor only changes the options. Changing options only has basic support atm.
        } else {
          $.data( this, name, new $.openTok( options, this ) );
        }
      });
    }

    return returnValue;
  };

  $.openTok = function( options, element ) {
    // allow instantiation without initializing for simple inheritance
    if ( arguments.length ) {
      this.element = $(element);
      this.options = $.extend(true, {},
        this.options,
        options
      );
      var self = this;
      this.element.bind( "remove.openTok", function() {
        self.destroy();
      });
      this._init();
    }
  };

  $.openTok.event = {
    sessionConnected: "openTok_sessionConnected",
    sessionDisconnected: "openTok_sessionDisconnected",
    connectionCreated: "openTok_connectionCreated",
    connectionDestroyed: "openTok_connectionDestroyed",
    streamCreated: "openTok_streamCreated",
    streamDestroyed: "openTok_streamDestroyed"
  };

  $.openTok.logLevel = {
    none: TB.NONE,
    error: TB.ERROR,
    warn: TB.WARN,
    info: TB.INFO,
    debug: TB.DEBUG,
  };

  $.openTok.prototype = {
    count: 0,
    options: {
      apiKey: "",
      sessionId: "",
      connectionToken: "devtoken",
      logLevel: $.openTok.logLevel.none,
      cssSelectorAncestor: ".opentok-container",
      cssSelector: {
        connect: ".opentok-connect",
        disconnect: ".opentok-disconnect",
        publish: ".opentok-publish",
        unpublish: ".opentok-unpublish",
        streamContainer: ".opentok-streams",
        publisherContainer: ".opentok-publisher",
      },
      streamCssSelector: {
        close: ".opentok-close",
        mute: ".opentok-mute",
        unmute: ".opentok-unmute",
        muteToggle: ".opentok-mute-toggle",
        forceUnpublish: ".opentok-force-unpublish",
        forceDisconnect: ".opentok-force-disconnect",
        streamWrapper: ".opentok-stream",
      },
      container: {
        id: "streamContainer",
        width: 500,
        height: 340,
      },
      idPrefix: "ot",
      streamWrapper: '<div class="opentok-stream"><a href="#" class="opentok-mute">Mute</a><a href="#" class="opentok-unmute">Unmute</a><a href="#" class="opentok-close">Close</a></div>'
    },
    instances: {},
    status: {
      connected: false,
      publishing: false,
    },
    internal: {
      instance: undefined,
    },
    session: {},
    publisher: {},
    streams: {},
    _init: function(){
      var self = this;

      this.internal = $.extend({}, this.internal);

      this.css = {};
      this.css.cs = {}; // Holds the css selector strings
      this.css.jq = {}; // Holds jQuery selectors. ie., $(css.cs.method)

      this.streams = {};

      //this.status = {};

      this.ancestorJq = this.options.cssSelectorAncestor ? $(this.options.cssSelectorAncestor) : []; // Would use $() instead of [], but it is only 1.4+

      this.internal.instance = "ot_" + this.count;
      this.instances[this.internal.instance] = this.element;

      if(this.element.attr("id") === "") {
        this.element.attr("id", this.options.idPrefix + "_opentok_" + this.count);
      }

      this.internal.self = $.extend({}, {
        id: this.element.attr("id"),
        jq: this.element
      });

      TB.setLogLevel(this.options.logLevel);
      this.session = TB.initSession(this.options.sessionId);

      OpenTokLayoutContainer.init(this.options.container.id, this.options.container.width, this.options.container.height);

      $.each($.openTok.event, function(eventName,eventType) {
        if(self.options[eventName] !== undefined) {
          self.element.bind(eventType + ".openTok", self.options[eventName]); // With .openTok namespace.
          self.options[eventName] = undefined; // Destroy the handler pointer copy on the options. Reason, events can be added/removed in other ways so this could be obsolete and misleading.
        }
      });

      $.each(this.options.cssSelector, function(fn, cssSel) {
        self._cssSelector(fn, cssSel, self.internal.self.jq);
      });

      this._addHtmlEventListeners(this.session);

      this._updateButtons();

      $.openTok.prototype.count++;
    },
    _addHtmlEventListeners: function(session) {
      var self = this;

      // Create the event listeners
      session.addEventListener("sessionConnected", function(e) {
        self.status.connected = true;
        self._updateButtons();
        
        for(var i = 0; i < e.streams.length; i++){
          self._addStream(e.streams[i]);
        }

        self._trigger($.openTok.event.sessionConnected, e);

        // Re-layout the container with the new streams
        OpenTokLayoutContainer.layout();
      });
      session.addEventListener("sessionDisconnected", function(e) {
        for (x in self.streams){
          self._removeStream(self.streams[x].subscriber.stream);
        }
        self.status.connected = false;
        self.status.publishing = false;

        self._updateButtons();

        self._trigger($.openTok.event.sessionDisconnected, e);
      });
      session.addEventListener("connectionCreated", function(e) {
        self._trigger($.openTok.event.connectionCreated, e);
      });
      session.addEventListener("connectionDestroyed", function(e) {
        self._trigger($.openTok.event.connectionDestroyed);
      });
      session.addEventListener("streamCreated", function(e) {
        for(var i = 0; i < e.streams.length; i++){
          self._addStream(e.streams[i]);
        }
        self._trigger($.openTok.event.streamCreated, e);

        // Re-layout the container with the new streams
        OpenTokLayoutContainer.layout();
      });
      session.addEventListener("streamDestroyed", function(e) {
        e.preventDefault();
        for(var i = 0; i < e.streams.length; i++){
          //OpenTokLayoutContainer.removeStream($.openTok.prototype.options.idPrefix + "_opentok_stream_" + e.streams[i].streamId);
          self._removeStream(e.streams[i]);
        }
        self._trigger($.openTok.event.streamDestroyed, e);

        // Re-layout the container with the new streams
        OpenTokLayoutContainer.layout();
      });
    },
    _trigger: function(eventType, eventData) { // eventType always valid as called using $.openTok.event.eventType
      var event = $.Event(eventType);
      event.openTok = {};
      event.openTok.status = $.extend(true, {}, this.status); // Deep copy
      event.openTok.eventData = eventData
      this.element.trigger(event);
    },
    _cssSelector: function(fn, cssSel, context) {
      var self = this;
      if(typeof cssSel === 'string') {
        if($.openTok.prototype.options.cssSelector[fn]) {
          if(this.css.jq[fn] && this.css.jq[fn].length) {
            this.css.jq[fn].unbind(".openTok");
          }
          this.options.cssSelector[fn] = cssSel;
          this.css.cs[fn] = /*this.options.cssSelectorAncestor + " " +*/ cssSel;

          if(cssSel) { // Checks for empty string
            this.css.jq[fn] = $(this.css.cs[fn], context);
          } else {
            this.css.jq[fn] = []; // To comply with the css.jq[fn].length check before its use. As of jQuery 1.4 could have used $() for an empty set.
          }

          if(this.css.jq[fn].length) {
            var handler = function(e) {
              self[fn](e);
              $(this).blur();
              return false;
            }
            this.css.jq[fn].bind("click.openTok", handler); // Using openTok namespace
          }
        }
      }
    },
    _streamCssSelector: function(fn, cssSel, context, parent) {
      var self = this;
      if(typeof cssSel === 'string') {
        if($.openTok.prototype.options.streamCssSelector[fn]) {
          if(parent.css.jq[fn] && parent.css.jq[fn].length) {
            parent.css.jq[fn].unbind(".openTok");
          }
          this.options.streamCssSelector[fn] = cssSel;
          parent.css.cs[fn] = /*this.options.cssSelectorAncestor + " " +*/ cssSel;

          if(cssSel) { // Checks for empty string
            parent.css.jq[fn] = $(parent.css.cs[fn], context);
          } else {
            parent.css.jq[fn] = []; // To comply with the css.jq[fn].length check before its use. As of jQuery 1.4 could have used $() for an empty set.
          }

          if(parent.css.jq[fn].length) {
            var handler = function(e) {
              self[fn](e, parent);
              $(this).blur();
              return false;
            }
            parent.css.jq[fn].bind("click.openTok", handler); // Using openTok namespace
          }
        }
      }
    },
    _addStream: function(stream){
      var self = this;
      if(stream.connection.connectionId == this.session.connection.connectionId){
        return;
      }

      var streamId = this.options.idPrefix + "_opentok_stream_" + stream.streamId;
      
      var streamWrapper;
      if($.isFunction(this.options.streamWrapper)){
        streamWrapper = $(this.options.streamWrapper(this.session, stream));
      }
      else{
        streamWrapper = $(this.options.streamWrapper);
      }
      
      var streamWrapperContainer = $('<div/>').attr("id", streamId).append(streamWrapper);
      
      $(this.options.streamCssSelector.streamWrapper, streamWrapperContainer).append($('<div/>').attr("id", streamId + "_stream"));

      this.css.jq.streamContainer.append(streamWrapperContainer);
      this.streams[stream.streamId] = {};
      this.streams[stream.streamId].css = {};
      this.streams[stream.streamId].css.cs = {}; // Holds the css selector strings
      this.streams[stream.streamId].css.jq = {};
      this.streams[stream.streamId].subscriber = this.session.subscribe(stream, streamId + "_stream");
      this.streams[stream.streamId].jq = streamWrapperContainer;
      $.each(this.options.streamCssSelector, function(fn, cssSel) {
        self._streamCssSelector(fn, cssSel, self.internal.self.jq, self.streams[stream.streamId]);
      });
      this._updateStreamButtons(stream);
    },
    _removeStream: function(stream){
      if(this.streams[stream.streamId]){
        this.streams[stream.streamId].jq.remove();
      }
      delete this.streams[stream.streamId];
    },
    _updateButtons: function(){
      this.css.jq.connect.toggle(!this.status.connected);
      this.css.jq.disconnect.toggle(this.status.connected);
      this.css.jq.publish.toggle(this.status.connected && !this.status.publishing);
      this.css.jq.unpublish.toggle(this.status.connected && this.status.publishing);
    },
    _updateStreamButtons: function(stream){
      this.streams[stream.streamId].css.jq.mute.toggle(!this.streams[stream.streamId].muted);
      this.streams[stream.streamId].css.jq.unmute.toggle(this.streams[stream.streamId].muted);
      this.streams[stream.streamId].css.jq.muteToggle.toggleClass('muted', this.streams[stream.streamId].muted);
      this.streams[stream.streamId].css.jq.forceUnpublish.toggle(Boolean(this.session.capabilities.forceUnpublish));
      this.streams[stream.streamId].css.jq.forceDisconnect.toggle(Boolean(this.session.capabilities.forceDisconnect));
    },
    connect: function(e){
      try {
        this.session.connect(this.options.apiKey, this.options.connectionToken);
      }
      catch(err) {
        alert(err);
      }
    },
    disconnect: function(e){
      this.session.disconnect();
    },
    publish: function(e){
      try{
        var publisherId = this.options.idPrefix + "_opentok_" + this.count + "_publisher";
        this.css.jq.publisherContainer.append($('<div/>').attr("id", publisherId));
        this.publisher = this.session.publish(publisherId);
      }
      catch(err){
        alert(err);
      }

      this.status.publishing = true;
      this._updateButtons();

      OpenTokLayoutContainer.layout();
    },
    unpublish: function(e){
      this.session.unpublish(this.publisher);
      delete this.publisher;
      this.status.publishing = false;
      this._updateButtons();
    },
    streamContainer: function(e){
      // Added to avoid errors using cssSelector system
    },
    publisherContainer: function(e){
      // Added to avoid errors using cssSelector system
    },
    streamWrapper: function(e){
      // Added to avoid errors using cssSelector system
    },
    close: function(e, stream){
      this.session.unsubscribe(stream.subscriber);
      this._removeStream(stream.subscriber.stream);
    },
    mute: function(e, stream){
      stream.subscriber.disableAudio();
      this.streams[stream.subscriber.stream.streamId].muted = true;
      this._updateStreamButtons(stream.subscriber.stream);
    },
    unmute: function(e, stream){
      stream.subscriber.enableAudio();
      this.streams[stream.subscriber.stream.streamId].muted = false;
      this._updateStreamButtons(stream.subscriber.stream);
    },
    muteToggle: function(e, stream){
      if(this.streams[stream.subscriber.stream.streamId].muted){
        stream.subscriber.enableAudio();
        this.streams[stream.subscriber.stream.streamId].muted = false;
      }
      else{
        stream.subscriber.disableAudio();
        this.streams[stream.subscriber.stream.streamId].muted = true;
      }
      this._updateStreamButtons(stream.subscriber.stream);
    },
    forceUnpublish: function(e, stream){
      if(this.session.capabilities.forceUnpublish){
        this.session.forceUnpublish(stream.subscriber.stream);
      }
    },
    forceDisconnect: function(e, stream){
      if(this.session.capabilities.forceDisconnect){
        this.session.forceDisconnect(stream.subscriber.stream.connection);
      }
    },
  };

  var OpenTokLayoutContainer = function() {
    /** @private */
    var Width;

    /** @private */
    var Height;

    /** @private */
    var containerId;

    /** @scope LayoutContainer */
    return {
      /**
       * Initializes the LayoutContainer.  Must be called prior to any other functions.
       * @param {String} divId ID of DIV to be used as the container.
       * @param {int} width Width of container DIV.
       * @param {int} height Height of container DIV.
      */
      init: function(divId, width, height){
        containerId = divId;
        Width = width;
        Height = height;
      },

      /**
       * Updates the container to incorporate any added or removed streams.
      */
      layout: function(){
        // Set the size of the container
        var subscriberBox = document.getElementById(containerId);
        subscriberBox.style.position = "relative";
        subscriberBox.style.width = Width + "px";
        subscriberBox.style.height = Height + "px";

        // Aspect ratio of the streams
        var vid_ratio = 3/4;

        // Finds the ideal number of columns and rows to minimize the amount of wasted space
        var count = subscriberBox.children.length;
        var min_diff;
        var targetCols;
        var targetRows;
        var availableRatio = Height / Width;
        for (var i=1; i <= count; i++) {
          var cols = i;
          var rows = Math.ceil(count / cols);
          var ratio = rows/cols * vid_ratio;
          var ratio_diff = Math.abs( availableRatio - ratio);
          if (!min_diff || (ratio_diff < min_diff)) {
            min_diff = ratio_diff;
            targetCols = cols;
            targetRows = rows;
          }
        };

        var videos_ratio = (targetRows/targetCols) * vid_ratio;

        if (videos_ratio > availableRatio) {
          targetHeight = Math.floor( Height/targetRows );
          targetWidth = Math.floor( targetHeight/vid_ratio );
        } else {
          targetWidth = Math.floor( Width/targetCols );
          targetHeight = Math.floor( targetWidth*vid_ratio );
        }

        var spacesInLastRow = (targetRows * targetCols) - count;
        var lastRowMargin = (spacesInLastRow * targetWidth / 2);
        var lastRowIndex = (targetRows - 1) * targetCols;

        var firstRowMarginTop = ((Height - (targetRows * targetHeight)) / 2);
        var firstColMarginLeft = ((Width - (targetCols * targetWidth)) / 2);

        // Loop through each stream in the container and place it inside
        var x = 0, y = 0;
        for (i=0; i < subscriberBox.children.length; i++) {
          if (i % targetCols == 0) {
            // We are the first element of the row
            x = firstColMarginLeft;
            if (i == lastRowIndex) x += lastRowMargin;
            y += i == 0 ? firstRowMarginTop : targetHeight;
          } else {
            x += targetWidth;
          }

          var parent = subscriberBox.children[i];
          var child = subscriberBox.children[i].firstChild;

          if(parent) {
            // All streams placed in absolute position relative to the layout container
            parent.style.position = "absolute";

            // Set position and size of the stream container
            parent.style.left = x + "px";
            parent.style.top = y + "px";
            parent.style.width = targetWidth + "px";
            parent.style.height = targetHeight + "px";
          }

          if(child) {
            // Set the height and width of the flash object (stream) that sits in the container
            child.width = targetWidth;
            child.height = targetHeight;
          }
        };
      },
      /**
       * Adds a stream to the layout container
       * @param {String} divId The ID of the DIV container that is passed to session.subscribe() or session.publish()
       * @param {bool} publisher True if the stream divId being passed in is a publisher.  False if the stream divId is a subscriber.
       */
      addStream: function(divId, publisher) {
        var container = document.createElement("div");
        if (publisher) {
          // Put the publisher object in front to allow clicking permissions dialog
          container.style.zIndex = 10;
        }

        var div = document.createElement("div");
        div.setAttribute('id', divId);
        container.appendChild(div);

        var subscriberBox = document.getElementById(containerId);
        subscriberBox.appendChild(container);
      },
      /**
       * Removes a stream from the layout container
       * @param {String} subscriberId The ID of the subscriber object from the stream to be removed.
       */
      removeStream: function(subscriberId) {
        // Gets the container that holds the flash object (stream) and removes it from the page
        var obj = document.getElementById(subscriberId);
        var container = obj.parentNode;
        container.parentNode.removeChild(container);
      }
    };
  }();
})(jQuery);
