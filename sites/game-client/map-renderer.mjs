// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

const mapCellSize = 32; // pixel
const fontStyle = '12px serif';

/**
 * MapRender renders the map onto the a canvas element.
 * The coordinate of canvas is shown at the end of the file.
 */
class MapRenderer {
  /**
   * Create a new MapRender.
   * @param {Canvas} canvas - The canvas to draw onto.
   * @param {GameMap} map - The map object to retrieve the map information.
   * @param {GameState} gameState - The game state.
   */
  constructor(canvas, map, gameState) {
    this.canvas = canvas;
    this.map = map;
    this.gameState = gameState;
    this.gameClient = null; // will be initialized in this.setGameClient()
    this.ctx = canvas.getContext('2d');
    this.viewerPosition = {x: NaN, y: NaN};

    /**
     * viewerPosition is the **map coordinate** of the center of canvas.
     * It is a real number, which enables smooth moving of the camera;
     */
    this.viewportFollow = null; // will be initialized in this.initializeViewerPosition()
    this.gameState.registerPlayerLocationChange((loc) => {
      if (this.viewportFollow === loc.playerID) {
        // TODO: smoothly update viewer position
        this.setViewerPosition(loc.x + 0.5, loc.y + 0.5);
      }
    });
  }

  /**
   * Set the GameClient of MapRenderer.
   * @param {GameClient} gameClient - The game state.
   */
  setGameClient(gameClient) {
    this.gameClient = gameClient;
  }

  /**
   * This function should be called after GameClient.onStartup()
   */
  initializeViewerPosition() {
    this.viewportFollow = this.gameClient.playerInfo.playerID;
    const {x, y} = this.gameState.getPlayer(this.viewportFollow);
    this.setViewerPosition(x + 0.5, y + 0.5);
  }

  /**
   * Return map canvas
   * @return {Canvas} - The using canvas
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Set the position of the viewer.
   * More precisely, the center of canvas will become (x, y).
   * If (x, y) is beyond the bound of the map, this function will clip the
   * coordinate to fit in the range of the map.
   * @param {Number} x - The x coordinate (map coordinate).
   * @param {Number} y - The y coordinate (map coordinate).
   */
  setViewerPosition(x, y) {
    const mapSize = this.map.getMapSize();
    const minX = (this.canvas.width / 2) / mapCellSize;
    const maxX = mapSize.width - minX;
    const minY = (this.canvas.height / 2) / mapCellSize;
    const maxY = mapSize.height - minY;
    x = Math.min(Math.max(x, minX), maxX);
    y = Math.min(Math.max(y, minY), maxY);
    this.viewerPosition.x = x;
    this.viewerPosition.y = y;
  }

  /**
   * Converts canvas coordinate to map coordinate.
   * @param {Number} x - The x coordinate in the canvas.
   * @param {Number} y - The y coordinate in the canvas.
   * @return {Object} coordinate - The map coordinate. coordinate.x and
   * coordinate.y is available. Both x and y are floating numbers.
   */
  canvasToMapCoordinate(x, y) {
    const canvasCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2};
    return {
      x: this.viewerPosition.x + (x - canvasCenter.x) / mapCellSize,
      y: this.viewerPosition.y + (y - canvasCenter.y) / mapCellSize,
    };
  }

  /**
   * Converts map coordinate to canvas coordinate.
   * @param {Number} x - The x coordinate in the map.
   * @param {Number} y - The y coordinate in the map.
   * @return {Object} coordinate - The canvas coordinate. coordinate.x and
   * coordinate.y is available. Both x and y are integer.
   */
  mapToCanvasCoordinate(x, y) {
    const canvasCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2};
    return {
      x: Math.floor(canvasCenter.x + (x - this.viewerPosition.x) * mapCellSize),
      y: Math.floor(canvasCenter.y + (y - this.viewerPosition.y) * mapCellSize),
    };
  }

  /**
   * Draw everything onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  draw() {
    let ret = true;
    ret &&= this._drawGround();
    ret &&= this._drawPlayers();

    return ret;
  }

  /**
   * Draw layer "ground" onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  _drawGround() {
    const firstCellMapCoordFloat = this.canvasToMapCoordinate(0, 0);
    const firstCellMapCoordInt = {
      x: Math.floor(firstCellMapCoordFloat.x),
      y: Math.floor(firstCellMapCoordFloat.y),
    };
    const lastCellMapCoordFloat = this.canvasToMapCoordinate(this.canvas.width, this.canvas.height);
    const lastCellMapCoordInt = {
      x: Math.floor(lastCellMapCoordFloat.x),
      y: Math.floor(lastCellMapCoordFloat.y),
    };
    const mapSize = this.map.getMapSize();

    const ret = true;
    for (let mapY = firstCellMapCoordInt.y; mapY <= lastCellMapCoordInt.y; ++mapY) {
      for (let mapX = firstCellMapCoordInt.x; mapX <= lastCellMapCoordInt.x; ++mapX) {
        if (mapX < 0 || mapX >= mapSize.width || mapY < 0 || mapY >= mapSize.height) continue;
        const renderInfo = this.map.getCellRenderInfo('ground', mapX, mapY);
        const canvasCoordinate = this.mapToCanvasCoordinate(mapX, mapY);
        this.ctx.drawImage(
            renderInfo.image,
            renderInfo.srcX,
            renderInfo.srcY,
            renderInfo.srcWidth,
            renderInfo.srcHeight,
            canvasCoordinate.x,
            canvasCoordinate.y,
            mapCellSize,
            mapCellSize,
        );
      }
    }
    return ret;
  }

  /**
   * Draw players onto the canvas.
   * @return {Boolean} success - Return true if successful.
   */
  _drawPlayers() {
    const players = this.gameState.getPlayers();
    for (const {x, y, displayChar, facing} of Object.values(players)) {
      const canvasCoordinate = this.mapToCanvasCoordinate(x, y);
      // check if this player is out of viewport
      if (canvasCoordinate.x < -mapCellSize ||
          canvasCoordinate.x >= this.canvas.width ||
          canvasCoordinate.y < -mapCellSize ||
          canvasCoordinate.y >= this.canvas.height) {
        continue;
      }
      const renderInfo = this.map.graphicAsset.getCharacter(displayChar,
          facing);
      this.ctx.drawImage(
          renderInfo.image,
          renderInfo.srcX,
          renderInfo.srcY,
          renderInfo.srcWidth,
          renderInfo.srcHeight,
          canvasCoordinate.x,
          canvasCoordinate.y,
          mapCellSize,
          mapCellSize,
      );
    }

    // draw displayName
    this.ctx.save();
    this.ctx.font = fontStyle;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    for (const {x, y, displayName} of Object.values(players)) {
      const canvasCoordinate = this.mapToCanvasCoordinate(x + 0.5, y);
      // there is no need for out-of-canvas check
      this.ctx.fillText(displayName, canvasCoordinate.x, canvasCoordinate.y);
    }
    this.ctx.restore();
    return true;
  }
}

export default MapRenderer;


/*
Below demonstrates the coordinate of the canvas:
Be careful not to get confused with "map coordinate".
format: (y, x)
unit: pixel

  (0,0)   (0,1)   (0,2)

  (1,0)   (1,1)   (1,2)   ...

  (2,0)   (2,1)   (2,2)

          ...

*/
