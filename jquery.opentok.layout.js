(function ($) {
  if(!$.openTokLayout){
    $.openTokLayout = { };
  }
  
  $.openTokLayout.defaults = {
      minMarginHeight: 6,
      minMarginWidth: 6,
      aspectRatio: 4/3,
  };
  
  $.fn.openTokLayout = function( options ) {
    //this.options = $.extend($.openTokLayout.defaults, options);
    var returnValue = this;
    var bindEvents = [$.openTok.event.streamAdded, $.openTok.event.streamRemoved, $.openTok.event.publish, $.openTok.publisherEvent.resize, $.openTok.event.containerResize].join(' '); 
    this.bind(bindEvents, function(e){
      $.openTokLayout.tileLayout(e.openTok.element);
    });
  };
  
  $.openTokLayout.tileLayout = function(openTokElement){
    var openTokOptions = openTokElement.openTok('option');
    var streamContainer = $(openTokOptions.cssSelector.streamsContainer, openTokElement);
    
    var streamObjects = $([openTokOptions.streamCssSelector.streamContainer, openTokOptions.cssSelector.publisherContainer].join(', ') , streamContainer).find('object');
    
    var numTiles = streamObjects.length;
    var containerWidth = streamContainer.width();
    var containerHeight = streamContainer.height();
    var aspectRatio = 4/3;
    
    var minMarginHeight = 6;
    var minMarginWidth = 6;

    var tileSize = $.openTokLayout.tileSize(numTiles, containerWidth, containerHeight, aspectRatio);
   
    var marginWidth = 0;
    var marginHeight = 0;
    if(containerWidthSpace = (containerWidth - (tileSize.width * tileSize.columns))){
       marginWidth = (containerWidthSpace / tileSize.columns) / 2;
    }
    if(containerHeightSpace = (containerHeight -(tileSize.height * tileSize.rows))){
      marginHeight = (containerHeightSpace / tileSize.rows) / 2;
    }
   
    if(marginHeight < minMarginHeight){
      tileSize.height = tileSize.height - ((minMarginHeight - marginHeight) * 2);
      marginHeight = minMarginHeight;
    }
    
    if(marginWidth < minMarginWidth){
      tileSize.width = tileSize.width - ((minMarginWidth - marginWidth) * 2);
      marginWidth = minMarginWidth;
    }
    
    var emptyTiles;
    var lastRowTiles;
    var lastRowMarginWidth;
    if(emptyTiles = tileSize.gridSize - numTiles){
      lastRowTiles = (tileSize.columns - emptyTiles);
      lastRowMarginWidth = ((containerWidth - (tileSize.width * lastRowTiles)) / lastRowTiles) / 2;  
    }
    
    
    $([openTokOptions.streamCssSelector.streamWrapper, openTokOptions.cssSelector.publisherWrapper].join(', '), streamContainer).each(function(i){
      if(emptyTiles && i >= tileSize.columns * (tileSize.rows - 1)){
        $(this).css("margin-left", lastRowMarginWidth+'px')
        .css("margin-right", lastRowMarginWidth+'px')
        .css("margin-top", marginHeight+'px')
        .css("margin-bottom", marginHeight+'px');        
      }
      else{
        $(this).css("margin-left", marginWidth+'px')
          .css("margin-right", marginWidth+'px')
          .css("margin-top", marginHeight+'px')
          .css("margin-bottom", marginHeight+'px');        
      }
    });
    
    var publisherWrapper = $(openTokOptions.cssSelector.publisherWrapper);
    var markupWidth = publisherWrapper.outerWidth() - publisherWrapper.width();
    var markupHeight = publisherWrapper.outerHeight() - publisherWrapper.height();
    
    tileSize.width = tileSize.width - markupWidth;
    tileSize.height = tileSize.height - markupHeight;
    
    streamObjects.each(function(){
      this.width = tileSize.width;
      this.height = tileSize.height;
    });
  };
  
  $.openTokLayout.tileSize = function(numTiles, containerWidth, containerHeight, aspectRatio){
    var newTileWidth;
    var newTileHeight;

    var tileWidth = aspectRatio;
    var tileHeight = 1;

    var numColumns = Math.sqrt( (numTiles * tileHeight * containerWidth) / (containerHeight * tileWidth) );

    var lowBoundColumns = Math.floor(numColumns);
    var highBoundColumns = Math.ceil(numColumns);

    var lowNumRows = Math.ceil(numTiles / lowBoundColumns);
    var highNumRows = Math.ceil(numTiles / highBoundColumns);

    var verticalScale = containerHeight / lowNumRows * tileHeight;
    var horizontalScale = containerWidth / (highBoundColumns * tileWidth);
    var maxHorizontalArea = (horizontalScale * tileWidth) * ((horizontalScale * tileWidth) / aspectRatio);
    var maxVerticalArea = (verticalScale * tileHeight) * ((verticalScale * tileHeight) * aspectRatio);

    if (maxHorizontalArea >= maxVerticalArea){
      newTileWidth = containerWidth / highBoundColumns;
      newTileHeight = newTileWidth / aspectRatio;
      if (newTileHeight * Math.ceil(numTiles / highBoundColumns) > containerHeight){
        var newHeight = containerHeight / highNumRows;
        var newWidth = newHeight * aspectRatio;
        if (newWidth * numTiles < containerWidth){
          newWidth = containerWidth / Math.ceil(numColumns++);
          newHeight = newWidth / aspectRatio;
          while (newWidth * numTiles > containerWidth){
            newWidth = containerWidth / Math.ceil(numColumns++);
            newHeight = newWidth / aspectRatio;
          }
          if (newHeight > containerHeight){
            newHeight = containerHeight;
            newWidth = newHeight * aspectRatio;
          }
        }
        var currentCols = Math.floor(containerWidth / newWidth); 
        var currentRows = Math.ceil(numTiles/currentCols);
        if ( (newWidth * currentCols ) < containerWidth 
            && ( newHeight * Math.ceil(numTiles/currentCols) ) < containerHeight){
          newWidth = containerWidth / currentCols;
          newHeight = newTileWidth / aspectRatio;
          if (newHeight * Math.ceil(numTiles / currentCols) > containerHeight)
          {
              newHeight = containerHeight / currentRows;
              newWidth = newHeight * aspectRatio;
          }
        }

        newTileHeight = newHeight;
        newTileWidth = newWidth;
      }
    }
    else
    {
      
      newTileHeight = containerHeight / lowNumRows;
      newTileWidth = newTileHeight * aspectRatio;
    }
    
    var numCols = Math.floor(containerWidth / newTileWidth);
    var numRows = Math.ceil(numTiles / numCols);
    var gridSize = numCols * numRows;
    
    return {height: newTileHeight, width: newTileWidth, columns: numCols, rows: numRows, gridSize: gridSize};
  };
})(jQuery);
