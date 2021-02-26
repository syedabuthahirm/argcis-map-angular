import { Component, Input, OnInit } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import Draw from '@arcgis/core/views/2d/draw/Draw';
import Graphic from '@arcgis/core/Graphic';
import Extent from '@arcgis/core/geometry/Extent';
import * as watchUtils from '@arcgis/core/core/watchUtils';

@Component({
  selector: 'app-navigation-toolbar',
  templateUrl: './navigation-toolbar.component.html',
  styleUrls: ['./navigation-toolbar.component.css']
})

export class NavigationToolbarComponent implements OnInit {
  @Input('mapView') view: MapView;

  private fullExtent: any = null;
  private draw: any = null;
  private _prevExtent = false;
  private _preExtent = null;
  private _currentExtent = null;
  private _extentHistory = [];
  private _extentHistoryIndx = 0;
  private _nextExtent = false;
  private evtViewDragHandler = null;
  private evtViewKeyDownHandler = null;

  constructor() {
    this.draw = new Draw({ view: this.view });
  }

  ngOnInit(): void {
    watchUtils.whenTrue(this.view, "ready", () => {
      this.fullExtent = this.view.extent.clone();
      this.draw = new Draw({
        view: this.view
      });
      watchUtils.whenOnce(this.view, "extent", () => {
        watchUtils.when(this.view, 'stationary', (evt) => {
          if (evt) {
            this.extentChangeHandler(this.view.extent);
          }
        });
      });
    });
  }

  extentChangeHandler(evt) {
    if (this._prevExtent || this._nextExtent) {
      this._currentExtent = evt;
    } else {
      this._preExtent = this._currentExtent;
      this._currentExtent = evt;
      this._extentHistory.push({
        preExtent: this._preExtent,
        currentExtent: this._currentExtent
      });
      this._extentHistoryIndx = this._extentHistory.length - 1;
    }
    this._prevExtent = this._nextExtent = false;
    // this.extentHistoryChange(); dom changes
  }

  enableViewPanning() {
    if (this.evtViewDragHandler) {
      this.evtViewDragHandler.remove();
      this.evtViewDragHandler = null;
    }
    if (this.evtViewKeyDownHandler) {
      this.evtViewKeyDownHandler.remove();
      this.evtViewKeyDownHandler = null;
    }
  }

  disableViewPanning() {
    if (this.evtViewDragHandler) {
      this.evtViewDragHandler.remove();
      this.evtViewDragHandler = null;
    }
    if (this.evtViewKeyDownHandler) {
      this.evtViewKeyDownHandler.remove();
      this.evtViewKeyDownHandler = null;
    }
    this.evtViewDragHandler = this.view.on("drag", function (event) {
      // prevents panning with the mouse drag event
      event.stopPropagation();
    });

    this.evtViewKeyDownHandler = this.view.on("key-down", function (event) {
      // prevents panning with the arrow keys
      var keyPressed = event.key;
      if (keyPressed.slice(0, 5) === "Arrow") {
        event.stopPropagation();
      }
    });
  }

  displayCrosshairCursor() {
    this.view && this.view.container && this.view.container.style && "crosshair" !== this.view.container.style.cursor && (this.view.container.style.cursor = "crosshair")
  }

  displayPointerCursor() {
    this.view && this.view.container && this.view.container.style && "pointer" !== this.view.container.style.cursor && (this.view.container.style.cursor = "pointer")
  }

  displayDefaultCursor() {
    this.view && this.view.container && this.view.container.style && "default" !== this.view.container.style.cursor && (this.view.container.style.cursor = "default")
  }

  removeCurrentSelTool() {
    this.view.popup.close();
    // domClass.remove(dom.byId("panmap"), "selected");
    // domClass.remove(dom.byId("zoomin"), "selected");
    // domClass.remove(dom.byId("zoomout"), "selected");
  }

  drawRect(event) {
    var vertices = event.vertices;
    //remove existing graphic
    this.view.graphics.removeAll();
    if (vertices.length < 2) {
      return;
    }

    // create a new extent
    var extent = this.getExtentfromVertices(vertices);

    var graphic = new Graphic({
      geometry: extent,
      symbol: {
        type: "simple-fill", // autocasts as SimpleFillSymbol
        color: [0, 0, 0, 0.3],
        style: "solid",
        outline: { // autocasts as SimpleLineSymbol
          color: [255, 0, 0],
          width: 1
        }
      }
    });

    this.view.graphics.add(graphic);
  }

  zoomIn(evt) {
    this.draw.reset();
    this.view.graphics.removeAll();
    var action = this.draw.create("rectangle");
    this.view.focus();
    action.on("vertex-add", (event) => this.drawRect(event));
    action.on("draw-complete", (event) => this.zoomIn(event));
    action.on("cursor-update", (event) => this.drawRect(event));
    if (evt.vertices.length === 1) {
      this.view.goTo({ scale: (this.view.scale * .5) });
      return;
    }
    var extent = this.getExtentfromVertices(evt.vertices);
    if (extent.width !== 0 || extent.height !== 0) {
      this.view.goTo(extent);
    }
  }

  zoomOut(evt) {
    var vertices = evt.vertices;
    this.draw.reset();
    this.view.graphics.removeAll();
    var action = this.draw.create("rectangle");
    this.view.focus();
    action.on("vertex-add", (event) => this.drawRect(event));
    action.on("draw-complete", (event) => this.zoomOut(event));
    action.on("cursor-update", (event) => this.drawRect(event));
    if (evt.vertices.length === 1) {
      this.view.goTo({ scale: (this.view.scale * 2) });
      return;
    }
    var sx = vertices[0][0], sy = vertices[0][1];
    var ex = vertices[1][0], ey = vertices[1][1];
    var rect = {
      x: Math.min(sx, ex),
      y: Math.max(sy, ey),
      width: Math.abs(sx - ex),
      height: Math.abs(sy - ey),
      spatialReference: this.view.spatialReference
    };
    if (rect.width !== 0 || rect.height !== 0) {
      var scrPnt1 = this.view.toScreen(rect);
      var scrPnt2 = this.view.toScreen({ x: rect.x + rect.width, y: rect.y, spatialReference: rect.spatialReference });
      var mWidth = this.view.extent.width;
      var delta = (mWidth * this.view.width / Math.abs(scrPnt2.x - scrPnt1.x) - mWidth) / 2;
      var vExtent = this.view.extent;
      this.view.goTo(new Extent({
        xmin: vExtent.xmin - delta,
        ymin: vExtent.ymin - delta,
        xmax: vExtent.xmax + delta,
        ymax: vExtent.ymax + delta,
        spatialReference: vExtent.spatialReference
      }));
    }
  }

  getExtentfromVertices(vertices) {
    var sx = vertices[0][0], sy = vertices[0][1];
    var ex = vertices[1][0], ey = vertices[1][1];
    var rect = {
      x: Math.min(sx, ex),
      y: Math.max(sy, ey),
      width: Math.abs(sx - ex),
      height: Math.abs(sy - ey),
      spatialReference: this.view.spatialReference
    };
    if (rect.width !== 0 || rect.height !== 0) {
      return new Extent({
        xmin: (rect.x),
        ymin: (rect.y) - (rect.height),
        xmax: (rect.x) + (rect.width),
        ymax: (rect.y),
        spatialReference: rect.spatialReference
      });
    } else {
      return null;
    }
  }

  zoomInClick() {
    this.removeCurrentSelTool();
    this.disableViewPanning();
    this.view.graphics.removeAll();
    var action = this.draw.create("rectangle");
    this.displayCrosshairCursor();
    this.view.focus();
    action.on("vertex-add", (event) => this.drawRect(event));
    action.on("draw-complete", (event) => this.zoomIn(event));
    action.on("cursor-update", (event) => this.drawRect(event));
  }

  zoomOutClick() {
    this.removeCurrentSelTool();
    this.disableViewPanning();
    this.view.graphics.removeAll();
    var action = this.draw.create("rectangle");
    this.displayCrosshairCursor();
    this.view.focus();
    action.on("vertex-add", (event) => this.drawRect(event));
    action.on("draw-complete", (event) => this.zoomOut(event));
    action.on("cursor-update", (event) => this.drawRect(event));
  }

  panMapClick() {
    this.removeCurrentSelTool();
    this.enableViewPanning();
    this.displayDefaultCursor();
    this.draw.reset();
  }

  fullExtentClick() {
    this.view.goTo(this.fullExtent);
  }

  prevExtent() {
    if (this._extentHistory[this._extentHistoryIndx].preExtent) {
      this._prevExtent = true;
      this.view.goTo(this._extentHistory[this._extentHistoryIndx].preExtent);
      this._extentHistoryIndx--;
    }
  }

  nextExtent() {
    this._nextExtent = true;
    this._extentHistoryIndx++;
    this.view.goTo(this._extentHistory[this._extentHistoryIndx].currentExtent);
  }
}
