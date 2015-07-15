define('echarts/chart/map', [
    'require',
    './base',
    'zrender/shape/Text',
    'zrender/shape/Path',
    'zrender/shape/Circle',
    'zrender/shape/Rectangle',
    'zrender/shape/Line',
    'zrender/shape/Polygon',
    'zrender/shape/Ellipse',
    'zrender/shape/Image',
    '../component/dataRange',
    '../component/roamController',
    '../layer/heatmap',
    '../config',
    '../util/ecData',
    'zrender/tool/util',
    'zrender/config',
    'zrender/tool/event',
    '../util/mapData/params',
    '../util/mapData/textFixed',
    '../util/mapData/geoCoord',
    '../util/projection/svg',
    '../util/projection/normal',
    '../chart'
], function (require) {
    var ChartBase = require('./base');
    var TextShape = require('zrender/shape/Text');
    var PathShape = require('zrender/shape/Path');
    var CircleShape = require('zrender/shape/Circle');
    var RectangleShape = require('zrender/shape/Rectangle');
    var LineShape = require('zrender/shape/Line');
    var PolygonShape = require('zrender/shape/Polygon');
    var EllipseShape = require('zrender/shape/Ellipse');
    var ZrImage = require('zrender/shape/Image');
    require('../component/dataRange');
    require('../component/roamController');
    var HeatmapLayer = require('../layer/heatmap');
    var ecConfig = require('../config');
    ecConfig.map = {
        zlevel: 0,
        z: 2,
        mapType: 'china',
        showLegendSymbol: true,
        dataRangeHoverLink: true,
        hoverable: true,
        clickable: true,
        itemStyle: {
            normal: {
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                areaStyle: { color: '#ccc' },
                label: {
                    show: false,
                    textStyle: { color: 'rgb(139,69,19)' }
                }
            },
            emphasis: {
                borderColor: 'rgba(0,0,0,0)',
                borderWidth: 1,
                areaStyle: { color: 'rgba(255,215,0,0.8)' },
                label: {
                    show: false,
                    textStyle: { color: 'rgb(100,0,0)' }
                }
            }
        }
    };
    var ecData = require('../util/ecData');
    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
    var zrEvent = require('zrender/tool/event');
    var _mapParams = require('../util/mapData/params').params;
    var _textFixed = require('../util/mapData/textFixed');
    var _geoCoord = require('../util/mapData/geoCoord');
    function Map(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        var self = this;
        self._onmousewheel = function (params) {
            return self.__onmousewheel(params);
        };
        self._onmousedown = function (params) {
            return self.__onmousedown(params);
        };
        self._onmousemove = function (params) {
            return self.__onmousemove(params);
        };
        self._onmouseup = function (params) {
            return self.__onmouseup(params);
        };
        self._onroamcontroller = function (params) {
            return self.__onroamcontroller(params);
        };
        self._ondrhoverlink = function (params) {
            return self.__ondrhoverlink(params);
        };
        this._isAlive = true;
        this._selectedMode = {};
        this._activeMapType = {};
        this._clickable = {};
        this._hoverable = {};
        this._showLegendSymbol = {};
        this._selected = {};
        this._mapTypeMap = {};
        this._mapDataMap = {};
        this._nameMap = {};
        this._specialArea = {};
        this._refreshDelayTicket;
        this._mapDataRequireCounter;
        this._markAnimation = false;
        this._hoverLinkMap = {};
        this._roamMap = {};
        this._scaleLimitMap = {};
        this._mx;
        this._my;
        this._mousedown;
        this._justMove;
        this._curMapType;
        this.refresh(option);
        this.zr.on(zrConfig.EVENT.MOUSEWHEEL, this._onmousewheel);
        this.zr.on(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
        messageCenter.bind(ecConfig.EVENT.ROAMCONTROLLER, this._onroamcontroller);
        messageCenter.bind(ecConfig.EVENT.DATA_RANGE_HOVERLINK, this._ondrhoverlink);
    }
    Map.prototype = {
        type: ecConfig.CHART_TYPE_MAP,
        _buildShape: function () {
            var series = this.series;
            this.selectedMap = {};
            this._activeMapType = {};
            var legend = this.component.legend;
            var seriesName;
            var valueData = {};
            var mapType;
            var data;
            var name;
            var mapSeries = {};
            var mapValuePrecision = {};
            var valueCalculation = {};
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].type == ecConfig.CHART_TYPE_MAP) {
                    series[i] = this.reformOption(series[i]);
                    mapType = series[i].mapType;
                    mapSeries[mapType] = mapSeries[mapType] || {};
                    mapSeries[mapType][i] = true;
                    mapValuePrecision[mapType] = mapValuePrecision[mapType] || series[i].mapValuePrecision;
                    this._scaleLimitMap[mapType] = this._scaleLimitMap[mapType] || {};
                    series[i].scaleLimit && zrUtil.merge(this._scaleLimitMap[mapType], series[i].scaleLimit, true);
                    this._roamMap[mapType] = series[i].roam || this._roamMap[mapType];
                    if (this._hoverLinkMap[mapType] == null || this._hoverLinkMap[mapType]) {
                        this._hoverLinkMap[mapType] = series[i].dataRangeHoverLink;
                    }
                    this._nameMap[mapType] = this._nameMap[mapType] || {};
                    series[i].nameMap && zrUtil.merge(this._nameMap[mapType], series[i].nameMap, true);
                    this._activeMapType[mapType] = true;
                    if (series[i].textFixed) {
                        zrUtil.merge(_textFixed, series[i].textFixed, true);
                    }
                    if (series[i].geoCoord) {
                        zrUtil.merge(_geoCoord, series[i].geoCoord, true);
                    }
                    this._selectedMode[mapType] = this._selectedMode[mapType] || series[i].selectedMode;
                    if (this._hoverable[mapType] == null || this._hoverable[mapType]) {
                        this._hoverable[mapType] = series[i].hoverable;
                    }
                    if (this._clickable[mapType] == null || this._clickable[mapType]) {
                        this._clickable[mapType] = series[i].clickable;
                    }
                    if (this._showLegendSymbol[mapType] == null || this._showLegendSymbol[mapType]) {
                        this._showLegendSymbol[mapType] = series[i].showLegendSymbol;
                    }
                    valueCalculation[mapType] = valueCalculation[mapType] || series[i].mapValueCalculation;
                    seriesName = series[i].name;
                    this.selectedMap[seriesName] = legend ? legend.isSelected(seriesName) : true;
                    if (this.selectedMap[seriesName]) {
                        valueData[mapType] = valueData[mapType] || {};
                        data = series[i].data;
                        for (var j = 0, k = data.length; j < k; j++) {
                            name = this._nameChange(mapType, data[j].name);
                            valueData[mapType][name] = valueData[mapType][name] || {
                                seriesIndex: [],
                                valueMap: {},
                                precision: 0
                            };
                            for (var key in data[j]) {
                                if (key != 'value') {
                                    valueData[mapType][name][key] = data[j][key];
                                } else if (!isNaN(data[j].value)) {
                                    valueData[mapType][name].value == null && (valueData[mapType][name].value = 0);
                                    valueData[mapType][name].precision = Math.max(this.getPrecision(+data[j].value), valueData[mapType][name].precision);
                                    valueData[mapType][name].value += +data[j].value;
                                    valueData[mapType][name].valueMap[i] = +data[j].value;
                                }
                            }
                            valueData[mapType][name].seriesIndex.push(i);
                        }
                    }
                }
            }
            this._mapDataRequireCounter = 0;
            for (var mt in valueData) {
                this._mapDataRequireCounter++;
            }
            this._clearSelected();
            if (this._mapDataRequireCounter === 0) {
                this.clear();
                this.zr && this.zr.delShape(this.lastShapeList);
                this.lastShapeList = [];
            }
            for (var mt in valueData) {
                for (var k in valueData[mt]) {
                    if (valueCalculation[mt] == 'average') {
                        valueData[mt][k].value /= valueData[mt][k].seriesIndex.length;
                    }
                    var value = valueData[mt][k].value;
                    if (value != null) {
                        valueData[mt][k].value = value.toFixed(mapValuePrecision[mt] == null ? valueData[mt][k].precision : mapValuePrecision[mt]) - 0;
                    }
                }
                this._mapDataMap[mt] = this._mapDataMap[mt] || {};
                if (this._mapDataMap[mt].mapData) {
                    this._mapDataCallback(mt, valueData[mt], mapSeries[mt])(this._mapDataMap[mt].mapData);
                } else if (_mapParams[mt.replace(/\|.*/, '')].getGeoJson) {
                    this._specialArea[mt] = _mapParams[mt.replace(/\|.*/, '')].specialArea || this._specialArea[mt];
                    _mapParams[mt.replace(/\|.*/, '')].getGeoJson(this._mapDataCallback(mt, valueData[mt], mapSeries[mt]));
                }
            }
        },
        _mapDataCallback: function (mt, vd, ms) {
            var self = this;
            return function (md) {
                if (!self._isAlive || self._activeMapType[mt] == null) {
                    return;
                }
                if (mt.indexOf('|') != -1) {
                    md = self._getSubMapData(mt, md);
                }
                self._mapDataMap[mt].mapData = md;
                if (md.firstChild) {
                    self._mapDataMap[mt].rate = 1;
                    self._mapDataMap[mt].projection = require('../util/projection/svg');
                } else {
                    self._mapDataMap[mt].rate = 0.75;
                    self._mapDataMap[mt].projection = require('../util/projection/normal');
                }
                self._buildMap(mt, self._getProjectionData(mt, md, ms), vd, ms);
                self._buildMark(mt, ms);
                if (--self._mapDataRequireCounter <= 0) {
                    self.addShapeList();
                    self.zr.refreshNextFrame();
                }
                self._buildHeatmap(mt);
            };
        },
        _clearSelected: function () {
            for (var k in this._selected) {
                if (!this._activeMapType[this._mapTypeMap[k]]) {
                    delete this._selected[k];
                    delete this._mapTypeMap[k];
                }
            }
        },
        _getSubMapData: function (mapType, mapData) {
            var subType = mapType.replace(/^.*\|/, '');
            var features = mapData.features;
            for (var i = 0, l = features.length; i < l; i++) {
                if (features[i].properties && features[i].properties.name == subType) {
                    features = features[i];
                    if (subType == 'United States of America' && features.geometry.coordinates.length > 1) {
                        features = {
                            geometry: {
                                coordinates: features.geometry.coordinates.slice(5, 6),
                                type: features.geometry.type
                            },
                            id: features.id,
                            properties: features.properties,
                            type: features.type
                        };
                    }
                    break;
                }
            }
            return {
                'type': 'FeatureCollection',
                'features': [features]
            };
        },
        _getProjectionData: function (mapType, mapData, mapSeries) {
            var normalProjection = this._mapDataMap[mapType].projection;
            var province = [];
            var bbox = this._mapDataMap[mapType].bbox || normalProjection.getBbox(mapData, this._specialArea[mapType]);
            var transform;
            if (!this._mapDataMap[mapType].hasRoam) {
                transform = this._getTransform(bbox, mapSeries, this._mapDataMap[mapType].rate);
            } else {
                transform = this._mapDataMap[mapType].transform;
            }
            var lastTransform = this._mapDataMap[mapType].lastTransform || { scale: {} };
            var pathArray;
            if (transform.left != lastTransform.left || transform.top != lastTransform.top || transform.scale.x != lastTransform.scale.x || transform.scale.y != lastTransform.scale.y) {
                pathArray = normalProjection.geoJson2Path(mapData, transform, this._specialArea[mapType]);
                lastTransform = zrUtil.clone(transform);
            } else {
                transform = this._mapDataMap[mapType].transform;
                pathArray = this._mapDataMap[mapType].pathArray;
            }
            this._mapDataMap[mapType].bbox = bbox;
            this._mapDataMap[mapType].transform = transform;
            this._mapDataMap[mapType].lastTransform = lastTransform;
            this._mapDataMap[mapType].pathArray = pathArray;
            var position = [
                transform.left,
                transform.top
            ];
            for (var i = 0, l = pathArray.length; i < l; i++) {
                province.push(this._getSingleProvince(mapType, pathArray[i], position));
            }
            if (this._specialArea[mapType]) {
                for (var area in this._specialArea[mapType]) {
                    province.push(this._getSpecialProjectionData(mapType, mapData, area, this._specialArea[mapType][area], position));
                }
            }
            if (mapType == 'china') {
                var leftTop = this.geo2pos(mapType, _geoCoord['南海诸岛'] || _mapParams['南海诸岛'].textCoord);
                var scale = transform.scale.x / 10.5;
                var textPosition = [
                    32 * scale + leftTop[0],
                    83 * scale + leftTop[1]
                ];
                if (_textFixed['南海诸岛']) {
                    textPosition[0] += _textFixed['南海诸岛'][0];
                    textPosition[1] += _textFixed['南海诸岛'][1];
                }
                province.push({
                    name: this._nameChange(mapType, '南海诸岛'),
                    path: _mapParams['南海诸岛'].getPath(leftTop, scale),
                    position: position,
                    textX: textPosition[0],
                    textY: textPosition[1]
                });
            }
            return province;
        },
        _getSpecialProjectionData: function (mapType, mapData, areaName, mapSize, position) {
            mapData = this._getSubMapData('x|' + areaName, mapData);
            var normalProjection = require('../util/projection/normal');
            var bbox = normalProjection.getBbox(mapData);
            var leftTop = this.geo2pos(mapType, [
                mapSize.left,
                mapSize.top
            ]);
            var rightBottom = this.geo2pos(mapType, [
                mapSize.left + mapSize.width,
                mapSize.top + mapSize.height
            ]);
            var width = Math.abs(rightBottom[0] - leftTop[0]);
            var height = Math.abs(rightBottom[1] - leftTop[1]);
            var mapWidth = bbox.width;
            var mapHeight = bbox.height;
            var xScale = width / 0.75 / mapWidth;
            var yScale = height / mapHeight;
            if (xScale > yScale) {
                xScale = yScale * 0.75;
                width = mapWidth * xScale;
            } else {
                yScale = xScale;
                xScale = yScale * 0.75;
                height = mapHeight * yScale;
            }
            var transform = {
                OffsetLeft: leftTop[0],
                OffsetTop: leftTop[1],
                scale: {
                    x: xScale,
                    y: yScale
                }
            };
            var pathArray = normalProjection.geoJson2Path(mapData, transform);
            return this._getSingleProvince(mapType, pathArray[0], position);
        },
        _getSingleProvince: function (mapType, path, position) {
            var textPosition;
            var name = path.properties.name;
            var textFixed = _textFixed[name] || [
                0,
                0
            ];
            if (_geoCoord[name]) {
                textPosition = this.geo2pos(mapType, _geoCoord[name]);
            } else if (path.cp) {
                textPosition = [
                    path.cp[0] + textFixed[0],
                    path.cp[1] + textFixed[1]
                ];
            } else {
                var bbox = this._mapDataMap[mapType].bbox;
                textPosition = this.geo2pos(mapType, [
                    bbox.left + bbox.width / 2,
                    bbox.top + bbox.height / 2
                ]);
                textPosition[0] += textFixed[0];
                textPosition[1] += textFixed[1];
            }
            path.name = this._nameChange(mapType, name);
            path.position = position;
            path.textX = textPosition[0];
            path.textY = textPosition[1];
            return path;
        },
        _getTransform: function (bbox, mapSeries, rate) {
            var series = this.series;
            var mapLocation;
            var x;
            var cusX;
            var y;
            var cusY;
            var width;
            var height;
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            var padding = Math.round(Math.min(zrWidth, zrHeight) * 0.02);
            for (var key in mapSeries) {
                mapLocation = series[key].mapLocation || {};
                cusX = mapLocation.x || cusX;
                cusY = mapLocation.y || cusY;
                width = mapLocation.width || width;
                height = mapLocation.height || height;
            }
            x = this.parsePercent(cusX, zrWidth);
            x = isNaN(x) ? padding : x;
            y = this.parsePercent(cusY, zrHeight);
            y = isNaN(y) ? padding : y;
            width = width == null ? zrWidth - x - 2 * padding : this.parsePercent(width, zrWidth);
            height = height == null ? zrHeight - y - 2 * padding : this.parsePercent(height, zrHeight);
            var mapWidth = bbox.width;
            var mapHeight = bbox.height;
            var xScale = width / rate / mapWidth;
            var yScale = height / mapHeight;
            if (xScale > yScale) {
                xScale = yScale * rate;
                width = mapWidth * xScale;
            } else {
                yScale = xScale;
                xScale = yScale * rate;
                height = mapHeight * yScale;
            }
            if (isNaN(cusX)) {
                cusX = cusX || 'center';
                switch (cusX + '') {
                case 'center':
                    x = Math.floor((zrWidth - width) / 2);
                    break;
                case 'right':
                    x = zrWidth - width;
                    break;
                }
            }
            if (isNaN(cusY)) {
                cusY = cusY || 'center';
                switch (cusY + '') {
                case 'center':
                    y = Math.floor((zrHeight - height) / 2);
                    break;
                case 'bottom':
                    y = zrHeight - height;
                    break;
                }
            }
            return {
                left: x,
                top: y,
                width: width,
                height: height,
                baseScale: 1,
                scale: {
                    x: xScale,
                    y: yScale
                }
            };
        },
        _buildMap: function (mapType, mapData, valueData, mapSeries) {
            var series = this.series;
            var legend = this.component.legend;
            var dataRange = this.component.dataRange;
            var seriesName;
            var name;
            var data;
            var value;
            var queryTarget;
            var color;
            var font;
            var style;
            var highlightStyle;
            var shape;
            var textShape;
            for (var i = 0, l = mapData.length; i < l; i++) {
                style = zrUtil.clone(mapData[i]);
                highlightStyle = {
                    name: style.name,
                    path: style.path,
                    position: zrUtil.clone(style.position)
                };
                name = style.name;
                data = valueData[name];
                if (data) {
                    queryTarget = [data];
                    seriesName = '';
                    for (var j = 0, k = data.seriesIndex.length; j < k; j++) {
                        var serie = series[data.seriesIndex[j]];
                        queryTarget.push(serie);
                        seriesName += serie.name + ' ';
                        if (legend && this._showLegendSymbol[mapType] && legend.hasColor(serie.name)) {
                            this.shapeList.push(new CircleShape({
                                zlevel: serie.zlevel,
                                z: serie.z + 1,
                                position: zrUtil.clone(style.position),
                                _mapType: mapType,
                                style: {
                                    x: style.textX + 3 + j * 7,
                                    y: style.textY - 10,
                                    r: 3,
                                    color: legend.getColor(serie.name)
                                },
                                hoverable: false
                            }));
                        }
                    }
                    value = data.value;
                } else {
                    data = {
                        name: name,
                        value: '-'
                    };
                    seriesName = '';
                    queryTarget = [];
                    for (var key in mapSeries) {
                        queryTarget.push(series[key]);
                    }
                    value = '-';
                }
                this.ecTheme.map && queryTarget.push(this.ecTheme.map);
                queryTarget.push(ecConfig.map);
                color = dataRange && !isNaN(value) ? dataRange.getColor(value) : null;
                style.color = style.color || color || this.getItemStyleColor(this.deepQuery(queryTarget, 'itemStyle.normal.color'), data.seriesIndex, -1, data) || this.deepQuery(queryTarget, 'itemStyle.normal.areaStyle.color');
                style.strokeColor = style.strokeColor || this.deepQuery(queryTarget, 'itemStyle.normal.borderColor');
                style.lineWidth = style.lineWidth || this.deepQuery(queryTarget, 'itemStyle.normal.borderWidth');
                highlightStyle.color = this.getItemStyleColor(this.deepQuery(queryTarget, 'itemStyle.emphasis.color'), data.seriesIndex, -1, data) || this.deepQuery(queryTarget, 'itemStyle.emphasis.areaStyle.color') || style.color;
                highlightStyle.strokeColor = this.deepQuery(queryTarget, 'itemStyle.emphasis.borderColor') || style.strokeColor;
                highlightStyle.lineWidth = this.deepQuery(queryTarget, 'itemStyle.emphasis.borderWidth') || style.lineWidth;
                style.brushType = highlightStyle.brushType = style.brushType || 'both';
                style.lineJoin = highlightStyle.lineJoin = 'round';
                style._name = highlightStyle._name = name;
                font = this.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle');
                textShape = {
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase() + 1,
                    position: zrUtil.clone(style.position),
                    _mapType: mapType,
                    _geo: this.pos2geo(mapType, [
                        style.textX,
                        style.textY
                    ]),
                    style: {
                        brushType: 'fill',
                        x: style.textX,
                        y: style.textY,
                        text: this.getLabelText(name, value, queryTarget, 'normal'),
                        _name: name,
                        textAlign: 'center',
                        color: this.deepQuery(queryTarget, 'itemStyle.normal.label.show') ? this.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle.color') : 'rgba(0,0,0,0)',
                        textFont: this.getFont(font)
                    }
                };
                textShape._style = zrUtil.clone(textShape.style);
                textShape.highlightStyle = zrUtil.clone(textShape.style);
                if (this.deepQuery(queryTarget, 'itemStyle.emphasis.label.show')) {
                    textShape.highlightStyle.text = this.getLabelText(name, value, queryTarget, 'emphasis');
                    textShape.highlightStyle.color = this.deepQuery(queryTarget, 'itemStyle.emphasis.label.textStyle.color') || textShape.style.color;
                    font = this.deepQuery(queryTarget, 'itemStyle.emphasis.label.textStyle') || font;
                    textShape.highlightStyle.textFont = this.getFont(font);
                } else {
                    textShape.highlightStyle.color = 'rgba(0,0,0,0)';
                }
                shape = {
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    position: zrUtil.clone(style.position),
                    style: style,
                    highlightStyle: highlightStyle,
                    _style: zrUtil.clone(style),
                    _mapType: mapType
                };
                if (style.scale != null) {
                    shape.scale = zrUtil.clone(style.scale);
                }
                textShape = new TextShape(textShape);
                switch (shape.style.shapeType) {
                case 'rectangle':
                    shape = new RectangleShape(shape);
                    break;
                case 'line':
                    shape = new LineShape(shape);
                    break;
                case 'circle':
                    shape = new CircleShape(shape);
                    break;
                case 'polygon':
                    shape = new PolygonShape(shape);
                    break;
                case 'ellipse':
                    shape = new EllipseShape(shape);
                    break;
                default:
                    shape = new PathShape(shape);
                    if (shape.buildPathArray) {
                        shape.style.pathArray = shape.buildPathArray(shape.style.path);
                    }
                    break;
                }
                if (this._selectedMode[mapType] && (this._selected[name] && data.selected !== false) || data.selected === true) {
                    textShape.style = textShape.highlightStyle;
                    shape.style = shape.highlightStyle;
                }
                textShape.clickable = shape.clickable = this._clickable[mapType] && (data.clickable == null || data.clickable);
                if (this._selectedMode[mapType]) {
                    this._selected[name] = this._selected[name] != null ? this._selected[name] : data.selected;
                    this._mapTypeMap[name] = mapType;
                    if (data.selectable == null || data.selectable) {
                        shape.clickable = textShape.clickable = true;
                        shape.onclick = textShape.onclick = this.shapeHandler.onclick;
                    }
                }
                if (this._hoverable[mapType] && (data.hoverable == null || data.hoverable)) {
                    textShape.hoverable = shape.hoverable = true;
                    shape.hoverConnect = textShape.id;
                    textShape.hoverConnect = shape.id;
                } else {
                    textShape.hoverable = shape.hoverable = false;
                }
                ecData.pack(textShape, {
                    name: seriesName,
                    tooltip: this.deepQuery(queryTarget, 'tooltip')
                }, 0, data, 0, name);
                this.shapeList.push(textShape);
                ecData.pack(shape, {
                    name: seriesName,
                    tooltip: this.deepQuery(queryTarget, 'tooltip')
                }, 0, data, 0, name);
                this.shapeList.push(shape);
            }
        },
        _buildMark: function (mapType, mapSeries) {
            this._seriesIndexToMapType = this._seriesIndexToMapType || {};
            this.markAttachStyle = this.markAttachStyle || {};
            var position = [
                this._mapDataMap[mapType].transform.left,
                this._mapDataMap[mapType].transform.top
            ];
            if (mapType == 'none') {
                position = [
                    0,
                    0
                ];
            }
            for (var sIdx in mapSeries) {
                this._seriesIndexToMapType[sIdx] = mapType;
                this.markAttachStyle[sIdx] = {
                    position: position,
                    _mapType: mapType
                };
                this.buildMark(sIdx);
            }
        },
        _buildHeatmap: function (mapType) {
            var series = this.series;
            for (var i = 0, l = series.length; i < l; i++) {
                if (series[i].heatmap) {
                    var data = series[i].heatmap.data;
                    if (series[i].heatmap.needsTransform === false) {
                        var geo = [];
                        for (var j = 0, len = data.length; j < len; ++j) {
                            geo.push([
                                data[j][3],
                                data[j][4],
                                data[j][2]
                            ]);
                        }
                        var pos = [
                            0,
                            0
                        ];
                    } else {
                        var geoData = series[i].heatmap._geoData;
                        if (geoData === undefined) {
                            series[i].heatmap._geoData = [];
                            for (var j = 0, len = data.length; j < len; ++j) {
                                series[i].heatmap._geoData[j] = data[j];
                            }
                            geoData = series[i].heatmap._geoData;
                        }
                        var len = data.length;
                        for (var id = 0; id < len; ++id) {
                            data[id] = this.geo2pos(mapType, [
                                geoData[id][0],
                                geoData[id][1]
                            ]);
                        }
                        var pos = [
                            this._mapDataMap[mapType].transform.left,
                            this._mapDataMap[mapType].transform.top
                        ];
                    }
                    var layer = new HeatmapLayer(series[i].heatmap.itemStyle);
                    var canvas = layer.getCanvas(data[0][3] ? geo : data, this.zr.getWidth(), this.zr.getHeight());
                    var image = new ZrImage({
                        zlevel: this.getZlevelBase(),
                        z: this.getZBase() + 1,
                        position: pos,
                        scale: [
                            1,
                            1
                        ],
                        hoverable: false,
                        style: {
                            x: 0,
                            y: 0,
                            image: canvas,
                            width: canvas.width,
                            height: canvas.height
                        }
                    });
                    image.type = 'heatmap';
                    image._mapType = mapType;
                    this.shapeList.push(image);
                    this.zr.addShape(image);
                }
            }
        },
        getMarkCoord: function (seriesIndex, mpData) {
            return mpData.geoCoord || _geoCoord[mpData.name] ? this.geo2pos(this._seriesIndexToMapType[seriesIndex], mpData.geoCoord || _geoCoord[mpData.name]) : [
                0,
                0
            ];
        },
        getMarkGeo: function (mpData) {
            return mpData.geoCoord || _geoCoord[mpData.name];
        },
        _nameChange: function (mapType, name) {
            return this._nameMap[mapType][name] || name;
        },
        getLabelText: function (name, value, queryTarget, status) {
            var formatter = this.deepQuery(queryTarget, 'itemStyle.' + status + '.label.formatter');
            if (formatter) {
                if (typeof formatter == 'function') {
                    return formatter.call(this.myChart, name, value);
                } else if (typeof formatter == 'string') {
                    formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}');
                    formatter = formatter.replace('{a0}', name).replace('{b0}', value);
                    return formatter;
                }
            } else {
                return name;
            }
        },
        _findMapTypeByPos: function (mx, my) {
            var transform;
            var left;
            var top;
            var width;
            var height;
            for (var mapType in this._mapDataMap) {
                transform = this._mapDataMap[mapType].transform;
                if (!transform || !this._roamMap[mapType] || !this._activeMapType[mapType]) {
                    continue;
                }
                left = transform.left;
                top = transform.top;
                width = transform.width;
                height = transform.height;
                if (mx >= left && mx <= left + width && my >= top && my <= top + height) {
                    return mapType;
                }
            }
            return;
        },
        __onmousewheel: function (params) {
            if (this.shapeList.length <= 0) {
                return;
            }
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                var shape = this.shapeList[i];
                if (shape.__animating) {
                    return;
                }
            }
            var event = params.event;
            var mx = zrEvent.getX(event);
            var my = zrEvent.getY(event);
            var delta;
            var eventDelta = zrEvent.getDelta(event);
            var mapType;
            var mapTypeControl = params.mapTypeControl;
            if (!mapTypeControl) {
                mapTypeControl = {};
                mapType = this._findMapTypeByPos(mx, my);
                if (mapType && this._roamMap[mapType] && this._roamMap[mapType] != 'move') {
                    mapTypeControl[mapType] = true;
                }
            }
            function scalePolyline(shapeStyle, delta) {
                for (var i = 0; i < shapeStyle.pointList.length; i++) {
                    var point = shapeStyle.pointList[i];
                    point[0] *= delta;
                    point[1] *= delta;
                }
                var controlPointList = shapeStyle.controlPointList;
                if (controlPointList) {
                    for (var i = 0; i < controlPointList.length; i++) {
                        var point = controlPointList[i];
                        point[0] *= delta;
                        point[1] *= delta;
                    }
                }
            }
            function scaleMarkline(shapeStyle, delta) {
                shapeStyle.xStart *= delta;
                shapeStyle.yStart *= delta;
                shapeStyle.xEnd *= delta;
                shapeStyle.yEnd *= delta;
                if (shapeStyle.cpX1 != null) {
                    shapeStyle.cpX1 *= delta;
                    shapeStyle.cpY1 *= delta;
                }
            }
            var haveScale = false;
            for (mapType in mapTypeControl) {
                if (mapTypeControl[mapType]) {
                    haveScale = true;
                    var transform = this._mapDataMap[mapType].transform;
                    var left = transform.left;
                    var top = transform.top;
                    var width = transform.width;
                    var height = transform.height;
                    var geoAndPos = this.pos2geo(mapType, [
                        mx - left,
                        my - top
                    ]);
                    if (eventDelta > 0) {
                        delta = 1.2;
                        if (this._scaleLimitMap[mapType].max != null && transform.baseScale >= this._scaleLimitMap[mapType].max) {
                            continue;
                        }
                    } else {
                        delta = 1 / 1.2;
                        if (this._scaleLimitMap[mapType].min != null && transform.baseScale <= this._scaleLimitMap[mapType].min) {
                            continue;
                        }
                    }
                    transform.baseScale *= delta;
                    transform.scale.x *= delta;
                    transform.scale.y *= delta;
                    transform.width = width * delta;
                    transform.height = height * delta;
                    this._mapDataMap[mapType].hasRoam = true;
                    this._mapDataMap[mapType].transform = transform;
                    geoAndPos = this.geo2pos(mapType, geoAndPos);
                    transform.left -= geoAndPos[0] - (mx - left);
                    transform.top -= geoAndPos[1] - (my - top);
                    this._mapDataMap[mapType].transform = transform;
                    this.clearEffectShape(true);
                    for (var i = 0, l = this.shapeList.length; i < l; i++) {
                        var shape = this.shapeList[i];
                        if (shape._mapType == mapType) {
                            var shapeType = shape.type;
                            var shapeStyle = shape.style;
                            shape.position[0] = transform.left;
                            shape.position[1] = transform.top;
                            switch (shapeType) {
                            case 'path':
                            case 'symbol':
                            case 'circle':
                            case 'rectangle':
                            case 'polygon':
                            case 'line':
                            case 'ellipse':
                            case 'heatmap':
                                shape.scale[0] *= delta;
                                shape.scale[1] *= delta;
                                break;
                            case 'mark-line':
                                scaleMarkline(shapeStyle, delta);
                                break;
                            case 'polyline':
                                scalePolyline(shapeStyle, delta);
                                break;
                            case 'shape-bundle':
                                for (var j = 0; j < shapeStyle.shapeList.length; j++) {
                                    var subShape = shapeStyle.shapeList[j];
                                    if (subShape.type == 'mark-line') {
                                        scaleMarkline(subShape.style, delta);
                                    } else if (subShape.type == 'polyline') {
                                        scalePolyline(subShape.style, delta);
                                    }
                                }
                                break;
                            case 'icon':
                            case 'image':
                                geoAndPos = this.geo2pos(mapType, shape._geo);
                                shapeStyle.x = shapeStyle._x = geoAndPos[0] - shapeStyle.width / 2;
                                shapeStyle.y = shapeStyle._y = geoAndPos[1] - shapeStyle.height / 2;
                                break;
                            default:
                                geoAndPos = this.geo2pos(mapType, shape._geo);
                                shapeStyle.x = geoAndPos[0];
                                shapeStyle.y = geoAndPos[1];
                                if (shapeType == 'text') {
                                    shape._style.x = shape.highlightStyle.x = geoAndPos[0];
                                    shape._style.y = shape.highlightStyle.y = geoAndPos[1];
                                }
                            }
                            this.zr.modShape(shape.id);
                        }
                    }
                }
            }
            if (haveScale) {
                zrEvent.stop(event);
                this.zr.refreshNextFrame();
                var self = this;
                clearTimeout(this._refreshDelayTicket);
                this._refreshDelayTicket = setTimeout(function () {
                    self && self.shapeList && self.animationEffect();
                }, 100);
                this.messageCenter.dispatch(ecConfig.EVENT.MAP_ROAM, params.event, { type: 'scale' }, this.myChart);
            }
        },
        __onmousedown: function (params) {
            if (this.shapeList.length <= 0) {
                return;
            }
            var target = params.target;
            if (target && target.draggable) {
                return;
            }
            var event = params.event;
            var mx = zrEvent.getX(event);
            var my = zrEvent.getY(event);
            var mapType = this._findMapTypeByPos(mx, my);
            if (mapType && this._roamMap[mapType] && this._roamMap[mapType] != 'scale') {
                this._mousedown = true;
                this._mx = mx;
                this._my = my;
                this._curMapType = mapType;
                this.zr.on(zrConfig.EVENT.MOUSEUP, this._onmouseup);
                var self = this;
                setTimeout(function () {
                    self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 100);
            }
        },
        __onmousemove: function (params) {
            if (!this._mousedown || !this._isAlive) {
                return;
            }
            var event = params.event;
            var mx = zrEvent.getX(event);
            var my = zrEvent.getY(event);
            var transform = this._mapDataMap[this._curMapType].transform;
            transform.hasRoam = true;
            transform.left -= this._mx - mx;
            transform.top -= this._my - my;
            this._mx = mx;
            this._my = my;
            this._mapDataMap[this._curMapType].transform = transform;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                if (this.shapeList[i]._mapType == this._curMapType) {
                    this.shapeList[i].position[0] = transform.left;
                    this.shapeList[i].position[1] = transform.top;
                    this.zr.modShape(this.shapeList[i].id);
                }
            }
            this.messageCenter.dispatch(ecConfig.EVENT.MAP_ROAM, params.event, { type: 'move' }, this.myChart);
            this.clearEffectShape(true);
            this.zr.refreshNextFrame();
            this._justMove = true;
            zrEvent.stop(event);
        },
        __onmouseup: function (params) {
            var event = params.event;
            this._mx = zrEvent.getX(event);
            this._my = zrEvent.getY(event);
            this._mousedown = false;
            var self = this;
            setTimeout(function () {
                self._justMove && self.animationEffect();
                self._justMove = false;
                self.zr.un(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                self.zr.un(zrConfig.EVENT.MOUSEUP, self._onmouseup);
            }, 120);
        },
        __onroamcontroller: function (params) {
            var event = params.event;
            event.zrenderX = this.zr.getWidth() / 2;
            event.zrenderY = this.zr.getHeight() / 2;
            var mapTypeControl = params.mapTypeControl;
            var top = 0;
            var left = 0;
            var step = params.step;
            switch (params.roamType) {
            case 'scaleUp':
                event.zrenderDelta = 1;
                this.__onmousewheel({
                    event: event,
                    mapTypeControl: mapTypeControl
                });
                return;
            case 'scaleDown':
                event.zrenderDelta = -1;
                this.__onmousewheel({
                    event: event,
                    mapTypeControl: mapTypeControl
                });
                return;
            case 'up':
                top = -step;
                break;
            case 'down':
                top = step;
                break;
            case 'left':
                left = -step;
                break;
            case 'right':
                left = step;
                break;
            }
            var transform;
            var curMapType;
            for (curMapType in mapTypeControl) {
                if (!this._mapDataMap[curMapType] || !this._activeMapType[curMapType]) {
                    continue;
                }
                transform = this._mapDataMap[curMapType].transform;
                transform.hasRoam = true;
                transform.left -= left;
                transform.top -= top;
                this._mapDataMap[curMapType].transform = transform;
            }
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                curMapType = this.shapeList[i]._mapType;
                if (!mapTypeControl[curMapType] || !this._activeMapType[curMapType]) {
                    continue;
                }
                transform = this._mapDataMap[curMapType].transform;
                this.shapeList[i].position[0] = transform.left;
                this.shapeList[i].position[1] = transform.top;
                this.zr.modShape(this.shapeList[i].id);
            }
            this.messageCenter.dispatch(ecConfig.EVENT.MAP_ROAM, params.event, { type: 'move' }, this.myChart);
            this.clearEffectShape(true);
            this.zr.refreshNextFrame();
            clearTimeout(this.dircetionTimer);
            var self = this;
            this.dircetionTimer = setTimeout(function () {
                self.animationEffect();
            }, 150);
        },
        __ondrhoverlink: function (param) {
            var curMapType;
            var value;
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                curMapType = this.shapeList[i]._mapType;
                if (!this._hoverLinkMap[curMapType] || !this._activeMapType[curMapType]) {
                    continue;
                }
                value = ecData.get(this.shapeList[i], 'value');
                if (value != null && value >= param.valueMin && value <= param.valueMax) {
                    this.zr.addHoverShape(this.shapeList[i]);
                }
            }
        },
        onclick: function (params) {
            if (!this.isClick || !params.target || this._justMove || params.target.type == 'icon') {
                return;
            }
            this.isClick = false;
            var target = params.target;
            var name = target.style._name;
            var len = this.shapeList.length;
            var mapType = target._mapType || '';
            if (this._selectedMode[mapType] == 'single') {
                for (var p in this._selected) {
                    if (this._selected[p] && this._mapTypeMap[p] == mapType) {
                        for (var i = 0; i < len; i++) {
                            if (this.shapeList[i].style._name == p && this.shapeList[i]._mapType == mapType) {
                                this.shapeList[i].style = this.shapeList[i]._style;
                                this.zr.modShape(this.shapeList[i].id);
                            }
                        }
                        p != name && (this._selected[p] = false);
                    }
                }
            }
            this._selected[name] = !this._selected[name];
            for (var i = 0; i < len; i++) {
                if (this.shapeList[i].style._name == name && this.shapeList[i]._mapType == mapType) {
                    if (this._selected[name]) {
                        this.shapeList[i].style = this.shapeList[i].highlightStyle;
                    } else {
                        this.shapeList[i].style = this.shapeList[i]._style;
                    }
                    this.zr.modShape(this.shapeList[i].id);
                }
            }
            this.messageCenter.dispatch(ecConfig.EVENT.MAP_SELECTED, params.event, {
                selected: this._selected,
                target: name
            }, this.myChart);
            this.zr.refreshNextFrame();
            var self = this;
            setTimeout(function () {
                self.zr.trigger(zrConfig.EVENT.MOUSEMOVE, params.event);
            }, 100);
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }
            if (this._mapDataRequireCounter > 0) {
                this.clear();
            } else {
                this.backupShapeList();
            }
            this._buildShape();
            this.zr.refreshHover();
        },
        ondataRange: function (param, status) {
            if (this.component.dataRange) {
                this.refresh();
                status.needRefresh = true;
            }
            return;
        },
        pos2geo: function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            return this._mapDataMap[mapType].projection.pos2geo(this._mapDataMap[mapType].transform, p);
        },
        getGeoByPos: function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            var position = [
                this._mapDataMap[mapType].transform.left,
                this._mapDataMap[mapType].transform.top
            ];
            if (p instanceof Array) {
                p[0] -= position[0];
                p[1] -= position[1];
            } else {
                p.x -= position[0];
                p.y -= position[1];
            }
            return this.pos2geo(mapType, p);
        },
        geo2pos: function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            return this._mapDataMap[mapType].projection.geo2pos(this._mapDataMap[mapType].transform, p);
        },
        getPosByGeo: function (mapType, p) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            var pos = this.geo2pos(mapType, p);
            pos[0] += this._mapDataMap[mapType].transform.left;
            pos[1] += this._mapDataMap[mapType].transform.top;
            return pos;
        },
        getMapPosition: function (mapType) {
            if (!this._mapDataMap[mapType].transform) {
                return null;
            }
            return [
                this._mapDataMap[mapType].transform.left,
                this._mapDataMap[mapType].transform.top
            ];
        },
        onbeforDispose: function () {
            this._isAlive = false;
            this.zr.un(zrConfig.EVENT.MOUSEWHEEL, this._onmousewheel);
            this.zr.un(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
            this.messageCenter.unbind(ecConfig.EVENT.ROAMCONTROLLER, this._onroamcontroller);
            this.messageCenter.unbind(ecConfig.EVENT.DATA_RANGE_HOVERLINK, this._ondrhoverlink);
        }
    };
    zrUtil.inherits(Map, ChartBase);
    require('../chart').define('map', Map);
    return Map;
});define('zrender/shape/Path', [
    'require',
    './Base',
    './util/PathProxy',
    '../tool/util'
], function (require) {
    var Base = require('./Base');
    var PathProxy = require('./util/PathProxy');
    var PathSegment = PathProxy.PathSegment;
    var vMag = function (v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    };
    var vRatio = function (u, v) {
        return (u[0] * v[0] + u[1] * v[1]) / (vMag(u) * vMag(v));
    };
    var vAngle = function (u, v) {
        return (u[0] * v[1] < u[1] * v[0] ? -1 : 1) * Math.acos(vRatio(u, v));
    };
    var Path = function (options) {
        Base.call(this, options);
    };
    Path.prototype = {
        type: 'path',
        buildPathArray: function (data, x, y) {
            if (!data) {
                return [];
            }
            x = x || 0;
            y = y || 0;
            var cs = data;
            var cc = [
                'm',
                'M',
                'l',
                'L',
                'v',
                'V',
                'h',
                'H',
                'z',
                'Z',
                'c',
                'C',
                'q',
                'Q',
                't',
                'T',
                's',
                'S',
                'a',
                'A'
            ];
            cs = cs.replace(/-/g, ' -');
            cs = cs.replace(/  /g, ' ');
            cs = cs.replace(/ /g, ',');
            cs = cs.replace(/,,/g, ',');
            var n;
            for (n = 0; n < cc.length; n++) {
                cs = cs.replace(new RegExp(cc[n], 'g'), '|' + cc[n]);
            }
            var arr = cs.split('|');
            var ca = [];
            var cpx = 0;
            var cpy = 0;
            for (n = 1; n < arr.length; n++) {
                var str = arr[n];
                var c = str.charAt(0);
                str = str.slice(1);
                str = str.replace(new RegExp('e,-', 'g'), 'e-');
                var p = str.split(',');
                if (p.length > 0 && p[0] === '') {
                    p.shift();
                }
                for (var i = 0; i < p.length; i++) {
                    p[i] = parseFloat(p[i]);
                }
                while (p.length > 0) {
                    if (isNaN(p[0])) {
                        break;
                    }
                    var cmd = null;
                    var points = [];
                    var ctlPtx;
                    var ctlPty;
                    var prevCmd;
                    var rx;
                    var ry;
                    var psi;
                    var fa;
                    var fs;
                    var x1 = cpx;
                    var y1 = cpy;
                    switch (c) {
                    case 'l':
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'L';
                        points.push(cpx, cpy);
                        break;
                    case 'L':
                        cpx = p.shift();
                        cpy = p.shift();
                        points.push(cpx, cpy);
                        break;
                    case 'm':
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'M';
                        points.push(cpx, cpy);
                        c = 'l';
                        break;
                    case 'M':
                        cpx = p.shift();
                        cpy = p.shift();
                        cmd = 'M';
                        points.push(cpx, cpy);
                        c = 'L';
                        break;
                    case 'h':
                        cpx += p.shift();
                        cmd = 'L';
                        points.push(cpx, cpy);
                        break;
                    case 'H':
                        cpx = p.shift();
                        cmd = 'L';
                        points.push(cpx, cpy);
                        break;
                    case 'v':
                        cpy += p.shift();
                        cmd = 'L';
                        points.push(cpx, cpy);
                        break;
                    case 'V':
                        cpy = p.shift();
                        cmd = 'L';
                        points.push(cpx, cpy);
                        break;
                    case 'C':
                        points.push(p.shift(), p.shift(), p.shift(), p.shift());
                        cpx = p.shift();
                        cpy = p.shift();
                        points.push(cpx, cpy);
                        break;
                    case 'c':
                        points.push(cpx + p.shift(), cpy + p.shift(), cpx + p.shift(), cpy + p.shift());
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'C';
                        points.push(cpx, cpy);
                        break;
                    case 'S':
                        ctlPtx = cpx;
                        ctlPty = cpy;
                        prevCmd = ca[ca.length - 1];
                        if (prevCmd.command === 'C') {
                            ctlPtx = cpx + (cpx - prevCmd.points[2]);
                            ctlPty = cpy + (cpy - prevCmd.points[3]);
                        }
                        points.push(ctlPtx, ctlPty, p.shift(), p.shift());
                        cpx = p.shift();
                        cpy = p.shift();
                        cmd = 'C';
                        points.push(cpx, cpy);
                        break;
                    case 's':
                        ctlPtx = cpx, ctlPty = cpy;
                        prevCmd = ca[ca.length - 1];
                        if (prevCmd.command === 'C') {
                            ctlPtx = cpx + (cpx - prevCmd.points[2]);
                            ctlPty = cpy + (cpy - prevCmd.points[3]);
                        }
                        points.push(ctlPtx, ctlPty, cpx + p.shift(), cpy + p.shift());
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'C';
                        points.push(cpx, cpy);
                        break;
                    case 'Q':
                        points.push(p.shift(), p.shift());
                        cpx = p.shift();
                        cpy = p.shift();
                        points.push(cpx, cpy);
                        break;
                    case 'q':
                        points.push(cpx + p.shift(), cpy + p.shift());
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'Q';
                        points.push(cpx, cpy);
                        break;
                    case 'T':
                        ctlPtx = cpx, ctlPty = cpy;
                        prevCmd = ca[ca.length - 1];
                        if (prevCmd.command === 'Q') {
                            ctlPtx = cpx + (cpx - prevCmd.points[0]);
                            ctlPty = cpy + (cpy - prevCmd.points[1]);
                        }
                        cpx = p.shift();
                        cpy = p.shift();
                        cmd = 'Q';
                        points.push(ctlPtx, ctlPty, cpx, cpy);
                        break;
                    case 't':
                        ctlPtx = cpx, ctlPty = cpy;
                        prevCmd = ca[ca.length - 1];
                        if (prevCmd.command === 'Q') {
                            ctlPtx = cpx + (cpx - prevCmd.points[0]);
                            ctlPty = cpy + (cpy - prevCmd.points[1]);
                        }
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'Q';
                        points.push(ctlPtx, ctlPty, cpx, cpy);
                        break;
                    case 'A':
                        rx = p.shift();
                        ry = p.shift();
                        psi = p.shift();
                        fa = p.shift();
                        fs = p.shift();
                        x1 = cpx, y1 = cpy;
                        cpx = p.shift(), cpy = p.shift();
                        cmd = 'A';
                        points = this._convertPoint(x1, y1, cpx, cpy, fa, fs, rx, ry, psi);
                        break;
                    case 'a':
                        rx = p.shift();
                        ry = p.shift();
                        psi = p.shift();
                        fa = p.shift();
                        fs = p.shift();
                        x1 = cpx, y1 = cpy;
                        cpx += p.shift();
                        cpy += p.shift();
                        cmd = 'A';
                        points = this._convertPoint(x1, y1, cpx, cpy, fa, fs, rx, ry, psi);
                        break;
                    }
                    for (var j = 0, l = points.length; j < l; j += 2) {
                        points[j] += x;
                        points[j + 1] += y;
                    }
                    ca.push(new PathSegment(cmd || c, points));
                }
                if (c === 'z' || c === 'Z') {
                    ca.push(new PathSegment('z', []));
                }
            }
            return ca;
        },
        _convertPoint: function (x1, y1, x2, y2, fa, fs, rx, ry, psiDeg) {
            var psi = psiDeg * (Math.PI / 180);
            var xp = Math.cos(psi) * (x1 - x2) / 2 + Math.sin(psi) * (y1 - y2) / 2;
            var yp = -1 * Math.sin(psi) * (x1 - x2) / 2 + Math.cos(psi) * (y1 - y2) / 2;
            var lambda = xp * xp / (rx * rx) + yp * yp / (ry * ry);
            if (lambda > 1) {
                rx *= Math.sqrt(lambda);
                ry *= Math.sqrt(lambda);
            }
            var f = Math.sqrt((rx * rx * (ry * ry) - rx * rx * (yp * yp) - ry * ry * (xp * xp)) / (rx * rx * (yp * yp) + ry * ry * (xp * xp)));
            if (fa === fs) {
                f *= -1;
            }
            if (isNaN(f)) {
                f = 0;
            }
            var cxp = f * rx * yp / ry;
            var cyp = f * -ry * xp / rx;
            var cx = (x1 + x2) / 2 + Math.cos(psi) * cxp - Math.sin(psi) * cyp;
            var cy = (y1 + y2) / 2 + Math.sin(psi) * cxp + Math.cos(psi) * cyp;
            var theta = vAngle([
                1,
                0
            ], [
                (xp - cxp) / rx,
                (yp - cyp) / ry
            ]);
            var u = [
                (xp - cxp) / rx,
                (yp - cyp) / ry
            ];
            var v = [
                (-1 * xp - cxp) / rx,
                (-1 * yp - cyp) / ry
            ];
            var dTheta = vAngle(u, v);
            if (vRatio(u, v) <= -1) {
                dTheta = Math.PI;
            }
            if (vRatio(u, v) >= 1) {
                dTheta = 0;
            }
            if (fs === 0 && dTheta > 0) {
                dTheta = dTheta - 2 * Math.PI;
            }
            if (fs === 1 && dTheta < 0) {
                dTheta = dTheta + 2 * Math.PI;
            }
            return [
                cx,
                cy,
                rx,
                ry,
                theta,
                dTheta,
                psi,
                fs
            ];
        },
        buildPath: function (ctx, style) {
            var path = style.path;
            var x = style.x || 0;
            var y = style.y || 0;
            style.pathArray = style.pathArray || this.buildPathArray(path, x, y);
            var pathArray = style.pathArray;
            var pointList = style.pointList = [];
            var singlePointList = [];
            for (var i = 0, l = pathArray.length; i < l; i++) {
                if (pathArray[i].command.toUpperCase() == 'M') {
                    singlePointList.length > 0 && pointList.push(singlePointList);
                    singlePointList = [];
                }
                var p = pathArray[i].points;
                for (var j = 0, k = p.length; j < k; j += 2) {
                    singlePointList.push([
                        p[j],
                        p[j + 1]
                    ]);
                }
            }
            singlePointList.length > 0 && pointList.push(singlePointList);
            for (var i = 0, l = pathArray.length; i < l; i++) {
                var c = pathArray[i].command;
                var p = pathArray[i].points;
                switch (c) {
                case 'L':
                    ctx.lineTo(p[0], p[1]);
                    break;
                case 'M':
                    ctx.moveTo(p[0], p[1]);
                    break;
                case 'C':
                    ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
                    break;
                case 'Q':
                    ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
                    break;
                case 'A':
                    var cx = p[0];
                    var cy = p[1];
                    var rx = p[2];
                    var ry = p[3];
                    var theta = p[4];
                    var dTheta = p[5];
                    var psi = p[6];
                    var fs = p[7];
                    var r = rx > ry ? rx : ry;
                    var scaleX = rx > ry ? 1 : rx / ry;
                    var scaleY = rx > ry ? ry / rx : 1;
                    ctx.translate(cx, cy);
                    ctx.rotate(psi);
                    ctx.scale(scaleX, scaleY);
                    ctx.arc(0, 0, r, theta, theta + dTheta, 1 - fs);
                    ctx.scale(1 / scaleX, 1 / scaleY);
                    ctx.rotate(-psi);
                    ctx.translate(-cx, -cy);
                    break;
                case 'z':
                    ctx.closePath();
                    break;
                }
            }
            return;
        },
        getRect: function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            var lineWidth;
            if (style.brushType == 'stroke' || style.brushType == 'fill') {
                lineWidth = style.lineWidth || 1;
            } else {
                lineWidth = 0;
            }
            var minX = Number.MAX_VALUE;
            var maxX = Number.MIN_VALUE;
            var minY = Number.MAX_VALUE;
            var maxY = Number.MIN_VALUE;
            var x = style.x || 0;
            var y = style.y || 0;
            var pathArray = style.pathArray || this.buildPathArray(style.path);
            for (var i = 0; i < pathArray.length; i++) {
                var p = pathArray[i].points;
                for (var j = 0; j < p.length; j++) {
                    if (j % 2 === 0) {
                        if (p[j] + x < minX) {
                            minX = p[j];
                        }
                        if (p[j] + x > maxX) {
                            maxX = p[j];
                        }
                    } else {
                        if (p[j] + y < minY) {
                            minY = p[j];
                        }
                        if (p[j] + y > maxY) {
                            maxY = p[j];
                        }
                    }
                }
            }
            var rect;
            if (minX === Number.MAX_VALUE || maxX === Number.MIN_VALUE || minY === Number.MAX_VALUE || maxY === Number.MIN_VALUE) {
                rect = {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0
                };
            } else {
                rect = {
                    x: Math.round(minX - lineWidth / 2),
                    y: Math.round(minY - lineWidth / 2),
                    width: maxX - minX + lineWidth,
                    height: maxY - minY + lineWidth
                };
            }
            style.__rect = rect;
            return rect;
        }
    };
    require('../tool/util').inherits(Path, Base);
    return Path;
});define('zrender/shape/Ellipse', [
    'require',
    './Base',
    '../tool/util'
], function (require) {
    var Base = require('./Base');
    var Ellipse = function (options) {
        Base.call(this, options);
    };
    Ellipse.prototype = {
        type: 'ellipse',
        buildPath: function (ctx, style) {
            var k = 0.5522848;
            var x = style.x;
            var y = style.y;
            var a = style.a;
            var b = style.b;
            var ox = a * k;
            var oy = b * k;
            ctx.moveTo(x - a, y);
            ctx.bezierCurveTo(x - a, y - oy, x - ox, y - b, x, y - b);
            ctx.bezierCurveTo(x + ox, y - b, x + a, y - oy, x + a, y);
            ctx.bezierCurveTo(x + a, y + oy, x + ox, y + b, x, y + b);
            ctx.bezierCurveTo(x - ox, y + b, x - a, y + oy, x - a, y);
            ctx.closePath();
        },
        getRect: function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            var lineWidth;
            if (style.brushType == 'stroke' || style.brushType == 'fill') {
                lineWidth = style.lineWidth || 1;
            } else {
                lineWidth = 0;
            }
            style.__rect = {
                x: Math.round(style.x - style.a - lineWidth / 2),
                y: Math.round(style.y - style.b - lineWidth / 2),
                width: style.a * 2 + lineWidth,
                height: style.b * 2 + lineWidth
            };
            return style.__rect;
        }
    };
    require('../tool/util').inherits(Ellipse, Base);
    return Ellipse;
});define('echarts/component/dataRange', [
    'require',
    './base',
    'zrender/shape/Text',
    'zrender/shape/Rectangle',
    '../util/shape/HandlePolygon',
    '../config',
    'zrender/tool/util',
    'zrender/tool/event',
    'zrender/tool/area',
    'zrender/tool/color',
    '../component'
], function (require) {
    var Base = require('./base');
    var TextShape = require('zrender/shape/Text');
    var RectangleShape = require('zrender/shape/Rectangle');
    var HandlePolygonShape = require('../util/shape/HandlePolygon');
    var ecConfig = require('../config');
    ecConfig.dataRange = {
        zlevel: 0,
        z: 4,
        show: true,
        orient: 'vertical',
        x: 'left',
        y: 'bottom',
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',
        borderWidth: 0,
        padding: 5,
        itemGap: 10,
        itemWidth: 20,
        itemHeight: 14,
        precision: 0,
        splitNumber: 5,
        splitList: null,
        calculable: false,
        selectedMode: true,
        hoverLink: true,
        realtime: true,
        color: [
            '#006edd',
            '#e0ffff'
        ],
        textStyle: { color: '#333' }
    };
    var zrUtil = require('zrender/tool/util');
    var zrEvent = require('zrender/tool/event');
    var zrArea = require('zrender/tool/area');
    var zrColor = require('zrender/tool/color');
    function DataRange(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        var self = this;
        self._ondrift = function (dx, dy) {
            return self.__ondrift(this, dx, dy);
        };
        self._ondragend = function () {
            return self.__ondragend();
        };
        self._dataRangeSelected = function (param) {
            return self.__dataRangeSelected(param);
        };
        self._dispatchHoverLink = function (param) {
            return self.__dispatchHoverLink(param);
        };
        self._onhoverlink = function (params) {
            return self.__onhoverlink(params);
        };
        this._selectedMap = {};
        this._range = {};
        this.refresh(option);
        messageCenter.bind(ecConfig.EVENT.HOVER, this._onhoverlink);
    }
    DataRange.prototype = {
        type: ecConfig.COMPONENT_TYPE_DATARANGE,
        _textGap: 10,
        _buildShape: function () {
            this._itemGroupLocation = this._getItemGroupLocation();
            this._buildBackground();
            if (this._isContinuity()) {
                this._buildGradient();
            } else {
                this._buildItem();
            }
            if (this.dataRangeOption.show) {
                for (var i = 0, l = this.shapeList.length; i < l; i++) {
                    this.zr.addShape(this.shapeList[i]);
                }
            }
            this._syncShapeFromRange();
        },
        _buildItem: function () {
            var data = this._valueTextList;
            var dataLength = data.length;
            var itemName;
            var itemShape;
            var textShape;
            var font = this.getFont(this.dataRangeOption.textStyle);
            var lastX = this._itemGroupLocation.x;
            var lastY = this._itemGroupLocation.y;
            var itemWidth = this.dataRangeOption.itemWidth;
            var itemHeight = this.dataRangeOption.itemHeight;
            var itemGap = this.dataRangeOption.itemGap;
            var textHeight = zrArea.getTextHeight('国', font);
            var color;
            if (this.dataRangeOption.orient == 'vertical' && this.dataRangeOption.x == 'right') {
                lastX = this._itemGroupLocation.x + this._itemGroupLocation.width - itemWidth;
            }
            var needValueText = true;
            if (this.dataRangeOption.text) {
                needValueText = false;
                if (this.dataRangeOption.text[0]) {
                    textShape = this._getTextShape(lastX, lastY, this.dataRangeOption.text[0]);
                    if (this.dataRangeOption.orient == 'horizontal') {
                        lastX += zrArea.getTextWidth(this.dataRangeOption.text[0], font) + this._textGap;
                    } else {
                        lastY += textHeight + this._textGap;
                        textShape.style.y += textHeight / 2 + this._textGap;
                        textShape.style.textBaseline = 'bottom';
                    }
                    this.shapeList.push(new TextShape(textShape));
                }
            }
            for (var i = 0; i < dataLength; i++) {
                itemName = data[i];
                color = this.getColorByIndex(i);
                itemShape = this._getItemShape(lastX, lastY, itemWidth, itemHeight, this._selectedMap[i] ? color : '#ccc');
                itemShape._idx = i;
                itemShape.onmousemove = this._dispatchHoverLink;
                if (this.dataRangeOption.selectedMode) {
                    itemShape.clickable = true;
                    itemShape.onclick = this._dataRangeSelected;
                }
                this.shapeList.push(new RectangleShape(itemShape));
                if (needValueText) {
                    textShape = {
                        zlevel: this.getZlevelBase(),
                        z: this.getZBase(),
                        style: {
                            x: lastX + itemWidth + 5,
                            y: lastY,
                            color: this._selectedMap[i] ? this.dataRangeOption.textStyle.color : '#ccc',
                            text: data[i],
                            textFont: font,
                            textBaseline: 'top'
                        },
                        highlightStyle: { brushType: 'fill' }
                    };
                    if (this.dataRangeOption.orient == 'vertical' && this.dataRangeOption.x == 'right') {
                        textShape.style.x -= itemWidth + 10;
                        textShape.style.textAlign = 'right';
                    }
                    textShape._idx = i;
                    textShape.onmousemove = this._dispatchHoverLink;
                    if (this.dataRangeOption.selectedMode) {
                        textShape.clickable = true;
                        textShape.onclick = this._dataRangeSelected;
                    }
                    this.shapeList.push(new TextShape(textShape));
                }
                if (this.dataRangeOption.orient == 'horizontal') {
                    lastX += itemWidth + (needValueText ? 5 : 0) + (needValueText ? zrArea.getTextWidth(itemName, font) : 0) + itemGap;
                } else {
                    lastY += itemHeight + itemGap;
                }
            }
            if (!needValueText && this.dataRangeOption.text[1]) {
                if (this.dataRangeOption.orient == 'horizontal') {
                    lastX = lastX - itemGap + this._textGap;
                } else {
                    lastY = lastY - itemGap + this._textGap;
                }
                textShape = this._getTextShape(lastX, lastY, this.dataRangeOption.text[1]);
                if (this.dataRangeOption.orient != 'horizontal') {
                    textShape.style.y -= 5;
                    textShape.style.textBaseline = 'top';
                }
                this.shapeList.push(new TextShape(textShape));
            }
        },
        _buildGradient: function () {
            var itemShape;
            var textShape;
            var font = this.getFont(this.dataRangeOption.textStyle);
            var lastX = this._itemGroupLocation.x;
            var lastY = this._itemGroupLocation.y;
            var itemWidth = this.dataRangeOption.itemWidth;
            var itemHeight = this.dataRangeOption.itemHeight;
            var textHeight = zrArea.getTextHeight('国', font);
            var mSize = 10;
            var needValueText = true;
            if (this.dataRangeOption.text) {
                needValueText = false;
                if (this.dataRangeOption.text[0]) {
                    textShape = this._getTextShape(lastX, lastY, this.dataRangeOption.text[0]);
                    if (this.dataRangeOption.orient == 'horizontal') {
                        lastX += zrArea.getTextWidth(this.dataRangeOption.text[0], font) + this._textGap;
                    } else {
                        lastY += textHeight + this._textGap;
                        textShape.style.y += textHeight / 2 + this._textGap;
                        textShape.style.textBaseline = 'bottom';
                    }
                    this.shapeList.push(new TextShape(textShape));
                }
            }
            var zrColor = require('zrender/tool/color');
            var per = 1 / (this.dataRangeOption.color.length - 1);
            var colorList = [];
            for (var i = 0, l = this.dataRangeOption.color.length; i < l; i++) {
                colorList.push([
                    i * per,
                    this.dataRangeOption.color[i]
                ]);
            }
            if (this.dataRangeOption.orient == 'horizontal') {
                itemShape = {
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        x: lastX,
                        y: lastY,
                        width: itemWidth * mSize,
                        height: itemHeight,
                        color: zrColor.getLinearGradient(lastX, lastY, lastX + itemWidth * mSize, lastY, colorList)
                    },
                    hoverable: false
                };
                lastX += itemWidth * mSize + this._textGap;
            } else {
                itemShape = {
                    zlevel: this.getZlevelBase(),
                    z: this.getZBase(),
                    style: {
                        x: lastX,
                        y: lastY,
                        width: itemWidth,
                        height: itemHeight * mSize,
                        color: zrColor.getLinearGradient(lastX, lastY, lastX, lastY + itemHeight * mSize, colorList)
                    },
                    hoverable: false
                };
                lastY += itemHeight * mSize + this._textGap;
            }
            this.shapeList.push(new RectangleShape(itemShape));
            this._calculableLocation = itemShape.style;
            if (this.dataRangeOption.calculable) {
                this._buildFiller();
                this._bulidMask();
                this._bulidHandle();
            }
            this._buildIndicator();
            if (!needValueText && this.dataRangeOption.text[1]) {
                textShape = this._getTextShape(lastX, lastY, this.dataRangeOption.text[1]);
                this.shapeList.push(new TextShape(textShape));
            }
        },
        _buildIndicator: function () {
            var x = this._calculableLocation.x;
            var y = this._calculableLocation.y;
            var width = this._calculableLocation.width;
            var height = this._calculableLocation.height;
            var size = 5;
            var pointList;
            var textPosition;
            if (this.dataRangeOption.orient == 'horizontal') {
                if (this.dataRangeOption.y != 'bottom') {
                    pointList = [
                        [
                            x,
                            y + height
                        ],
                        [
                            x - size,
                            y + height + size
                        ],
                        [
                            x + size,
                            y + height + size
                        ]
                    ];
                    textPosition = 'bottom';
                } else {
                    pointList = [
                        [
                            x,
                            y
                        ],
                        [
                            x - size,
                            y - size
                        ],
                        [
                            x + size,
                            y - size
                        ]
                    ];
                    textPosition = 'top';
                }
            } else {
                if (this.dataRangeOption.x != 'right') {
                    pointList = [
                        [
                            x + width,
                            y
                        ],
                        [
                            x + width + size,
                            y - size
                        ],
                        [
                            x + width + size,
                            y + size
                        ]
                    ];
                    textPosition = 'right';
                } else {
                    pointList = [
                        [
                            x,
                            y
                        ],
                        [
                            x - size,
                            y - size
                        ],
                        [
                            x - size,
                            y + size
                        ]
                    ];
                    textPosition = 'left';
                }
            }
            this._indicatorShape = {
                style: {
                    pointList: pointList,
                    color: '#fff',
                    __rect: {
                        x: Math.min(pointList[0][0], pointList[1][0]),
                        y: Math.min(pointList[0][1], pointList[1][1]),
                        width: size * (this.dataRangeOption.orient == 'horizontal' ? 2 : 1),
                        height: size * (this.dataRangeOption.orient == 'horizontal' ? 1 : 2)
                    }
                },
                highlightStyle: {
                    brushType: 'fill',
                    textPosition: textPosition,
                    textColor: this.dataRangeOption.textStyle.color
                },
                hoverable: false
            };
            this._indicatorShape = new HandlePolygonShape(this._indicatorShape);
        },
        _buildFiller: function () {
            this._fillerShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                style: {
                    x: this._calculableLocation.x,
                    y: this._calculableLocation.y,
                    width: this._calculableLocation.width,
                    height: this._calculableLocation.height,
                    color: 'rgba(255,255,255,0)'
                },
                highlightStyle: {
                    strokeColor: 'rgba(255,255,255,0.5)',
                    lineWidth: 1
                },
                draggable: true,
                ondrift: this._ondrift,
                ondragend: this._ondragend,
                onmousemove: this._dispatchHoverLink,
                _type: 'filler'
            };
            this._fillerShape = new RectangleShape(this._fillerShape);
            this.shapeList.push(this._fillerShape);
        },
        _bulidHandle: function () {
            var x = this._calculableLocation.x;
            var y = this._calculableLocation.y;
            var width = this._calculableLocation.width;
            var height = this._calculableLocation.height;
            var font = this.getFont(this.dataRangeOption.textStyle);
            var textHeight = zrArea.getTextHeight('国', font);
            var textWidth = Math.max(zrArea.getTextWidth(this._textFormat(this.dataRangeOption.max), font), zrArea.getTextWidth(this._textFormat(this.dataRangeOption.min), font)) + 2;
            var pointListStart;
            var textXStart;
            var textYStart;
            var coverRectStart;
            var pointListEnd;
            var textXEnd;
            var textYEnd;
            var coverRectEnd;
            if (this.dataRangeOption.orient == 'horizontal') {
                if (this.dataRangeOption.y != 'bottom') {
                    pointListStart = [
                        [
                            x,
                            y
                        ],
                        [
                            x,
                            y + height + textHeight
                        ],
                        [
                            x - textHeight,
                            y + height + textHeight
                        ],
                        [
                            x - 1,
                            y + height
                        ],
                        [
                            x - 1,
                            y
                        ]
                    ];
                    textXStart = x - textWidth / 2 - textHeight;
                    textYStart = y + height + textHeight / 2 + 2;
                    coverRectStart = {
                        x: x - textWidth - textHeight,
                        y: y + height,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                    pointListEnd = [
                        [
                            x + width,
                            y
                        ],
                        [
                            x + width,
                            y + height + textHeight
                        ],
                        [
                            x + width + textHeight,
                            y + height + textHeight
                        ],
                        [
                            x + width + 1,
                            y + height
                        ],
                        [
                            x + width + 1,
                            y
                        ]
                    ];
                    textXEnd = x + width + textWidth / 2 + textHeight;
                    textYEnd = textYStart;
                    coverRectEnd = {
                        x: x + width,
                        y: y + height,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                } else {
                    pointListStart = [
                        [
                            x,
                            y + height
                        ],
                        [
                            x,
                            y - textHeight
                        ],
                        [
                            x - textHeight,
                            y - textHeight
                        ],
                        [
                            x - 1,
                            y
                        ],
                        [
                            x - 1,
                            y + height
                        ]
                    ];
                    textXStart = x - textWidth / 2 - textHeight;
                    textYStart = y - textHeight / 2 - 2;
                    coverRectStart = {
                        x: x - textWidth - textHeight,
                        y: y - textHeight,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                    pointListEnd = [
                        [
                            x + width,
                            y + height
                        ],
                        [
                            x + width,
                            y - textHeight
                        ],
                        [
                            x + width + textHeight,
                            y - textHeight
                        ],
                        [
                            x + width + 1,
                            y
                        ],
                        [
                            x + width + 1,
                            y + height
                        ]
                    ];
                    textXEnd = x + width + textWidth / 2 + textHeight;
                    textYEnd = textYStart;
                    coverRectEnd = {
                        x: x + width,
                        y: y - textHeight,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                }
            } else {
                textWidth += textHeight;
                if (this.dataRangeOption.x != 'right') {
                    pointListStart = [
                        [
                            x,
                            y
                        ],
                        [
                            x + width + textHeight,
                            y
                        ],
                        [
                            x + width + textHeight,
                            y - textHeight
                        ],
                        [
                            x + width,
                            y - 1
                        ],
                        [
                            x,
                            y - 1
                        ]
                    ];
                    textXStart = x + width + textWidth / 2 + textHeight / 2;
                    textYStart = y - textHeight / 2;
                    coverRectStart = {
                        x: x + width,
                        y: y - textHeight,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                    pointListEnd = [
                        [
                            x,
                            y + height
                        ],
                        [
                            x + width + textHeight,
                            y + height
                        ],
                        [
                            x + width + textHeight,
                            y + textHeight + height
                        ],
                        [
                            x + width,
                            y + 1 + height
                        ],
                        [
                            x,
                            y + height + 1
                        ]
                    ];
                    textXEnd = textXStart;
                    textYEnd = y + height + textHeight / 2;
                    coverRectEnd = {
                        x: x + width,
                        y: y + height,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                } else {
                    pointListStart = [
                        [
                            x + width,
                            y
                        ],
                        [
                            x - textHeight,
                            y
                        ],
                        [
                            x - textHeight,
                            y - textHeight
                        ],
                        [
                            x,
                            y - 1
                        ],
                        [
                            x + width,
                            y - 1
                        ]
                    ];
                    textXStart = x - textWidth / 2 - textHeight / 2;
                    textYStart = y - textHeight / 2;
                    coverRectStart = {
                        x: x - textWidth - textHeight,
                        y: y - textHeight,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                    pointListEnd = [
                        [
                            x + width,
                            y + height
                        ],
                        [
                            x - textHeight,
                            y + height
                        ],
                        [
                            x - textHeight,
                            y + textHeight + height
                        ],
                        [
                            x,
                            y + 1 + height
                        ],
                        [
                            x + width,
                            y + height + 1
                        ]
                    ];
                    textXEnd = textXStart;
                    textYEnd = y + height + textHeight / 2;
                    coverRectEnd = {
                        x: x - textWidth - textHeight,
                        y: y + height,
                        width: textWidth + textHeight,
                        height: textHeight
                    };
                }
            }
            this._startShape = {
                style: {
                    pointList: pointListStart,
                    text: this._textFormat(this.dataRangeOption.max),
                    textX: textXStart,
                    textY: textYStart,
                    textFont: font,
                    color: this.getColor(this.dataRangeOption.max),
                    rect: coverRectStart,
                    x: pointListStart[0][0],
                    y: pointListStart[0][1],
                    _x: pointListStart[0][0],
                    _y: pointListStart[0][1]
                }
            };
            this._startShape.highlightStyle = {
                strokeColor: this._startShape.style.color,
                lineWidth: 1
            };
            this._endShape = {
                style: {
                    pointList: pointListEnd,
                    text: this._textFormat(this.dataRangeOption.min),
                    textX: textXEnd,
                    textY: textYEnd,
                    textFont: font,
                    color: this.getColor(this.dataRangeOption.min),
                    rect: coverRectEnd,
                    x: pointListEnd[0][0],
                    y: pointListEnd[0][1],
                    _x: pointListEnd[0][0],
                    _y: pointListEnd[0][1]
                }
            };
            this._endShape.highlightStyle = {
                strokeColor: this._endShape.style.color,
                lineWidth: 1
            };
            this._startShape.zlevel = this._endShape.zlevel = this.getZlevelBase();
            this._startShape.z = this._endShape.z = this.getZBase() + 1;
            this._startShape.draggable = this._endShape.draggable = true;
            this._startShape.ondrift = this._endShape.ondrift = this._ondrift;
            this._startShape.ondragend = this._endShape.ondragend = this._ondragend;
            this._startShape.style.textColor = this._endShape.style.textColor = this.dataRangeOption.textStyle.color;
            this._startShape.style.textAlign = this._endShape.style.textAlign = 'center';
            this._startShape.style.textPosition = this._endShape.style.textPosition = 'specific';
            this._startShape.style.textBaseline = this._endShape.style.textBaseline = 'middle';
            this._startShape.style.width = this._endShape.style.width = 0;
            this._startShape.style.height = this._endShape.style.height = 0;
            this._startShape.style.textPosition = this._endShape.style.textPosition = 'specific';
            this._startShape = new HandlePolygonShape(this._startShape);
            this._endShape = new HandlePolygonShape(this._endShape);
            this.shapeList.push(this._startShape);
            this.shapeList.push(this._endShape);
        },
        _bulidMask: function () {
            var x = this._calculableLocation.x;
            var y = this._calculableLocation.y;
            var width = this._calculableLocation.width;
            var height = this._calculableLocation.height;
            this._startMask = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                style: {
                    x: x,
                    y: y,
                    width: this.dataRangeOption.orient == 'horizontal' ? 0 : width,
                    height: this.dataRangeOption.orient == 'horizontal' ? height : 0,
                    color: '#ccc'
                },
                hoverable: false
            };
            this._endMask = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase() + 1,
                style: {
                    x: this.dataRangeOption.orient == 'horizontal' ? x + width : x,
                    y: this.dataRangeOption.orient == 'horizontal' ? y : y + height,
                    width: this.dataRangeOption.orient == 'horizontal' ? 0 : width,
                    height: this.dataRangeOption.orient == 'horizontal' ? height : 0,
                    color: '#ccc'
                },
                hoverable: false
            };
            this._startMask = new RectangleShape(this._startMask);
            this._endMask = new RectangleShape(this._endMask);
            this.shapeList.push(this._startMask);
            this.shapeList.push(this._endMask);
        },
        _buildBackground: function () {
            var padding = this.reformCssArray(this.dataRangeOption.padding);
            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable: false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: this.dataRangeOption.borderWidth === 0 ? 'fill' : 'both',
                    color: this.dataRangeOption.backgroundColor,
                    strokeColor: this.dataRangeOption.borderColor,
                    lineWidth: this.dataRangeOption.borderWidth
                }
            }));
        },
        _getItemGroupLocation: function () {
            var data = this._valueTextList;
            var dataLength = data.length;
            var itemGap = this.dataRangeOption.itemGap;
            var itemWidth = this.dataRangeOption.itemWidth;
            var itemHeight = this.dataRangeOption.itemHeight;
            var totalWidth = 0;
            var totalHeight = 0;
            var font = this.getFont(this.dataRangeOption.textStyle);
            var textHeight = zrArea.getTextHeight('国', font);
            var mSize = 10;
            if (this.dataRangeOption.orient == 'horizontal') {
                if (this.dataRangeOption.text || this._isContinuity()) {
                    totalWidth = (this._isContinuity() ? itemWidth * mSize + itemGap : dataLength * (itemWidth + itemGap)) + (this.dataRangeOption.text && typeof this.dataRangeOption.text[0] != 'undefined' ? zrArea.getTextWidth(this.dataRangeOption.text[0], font) + this._textGap : 0) + (this.dataRangeOption.text && typeof this.dataRangeOption.text[1] != 'undefined' ? zrArea.getTextWidth(this.dataRangeOption.text[1], font) + this._textGap : 0);
                } else {
                    itemWidth += 5;
                    for (var i = 0; i < dataLength; i++) {
                        totalWidth += itemWidth + zrArea.getTextWidth(data[i], font) + itemGap;
                    }
                }
                totalWidth -= itemGap;
                totalHeight = Math.max(textHeight, itemHeight);
            } else {
                var maxWidth;
                if (this.dataRangeOption.text || this._isContinuity()) {
                    totalHeight = (this._isContinuity() ? itemHeight * mSize + itemGap : dataLength * (itemHeight + itemGap)) + (this.dataRangeOption.text && typeof this.dataRangeOption.text[0] != 'undefined' ? this._textGap + textHeight : 0) + (this.dataRangeOption.text && typeof this.dataRangeOption.text[1] != 'undefined' ? this._textGap + textHeight : 0);
                    maxWidth = Math.max(zrArea.getTextWidth(this.dataRangeOption.text && this.dataRangeOption.text[0] || '', font), zrArea.getTextWidth(this.dataRangeOption.text && this.dataRangeOption.text[1] || '', font));
                    totalWidth = Math.max(itemWidth, maxWidth);
                } else {
                    totalHeight = (itemHeight + itemGap) * dataLength;
                    itemWidth += 5;
                    maxWidth = 0;
                    for (var i = 0; i < dataLength; i++) {
                        maxWidth = Math.max(maxWidth, zrArea.getTextWidth(data[i], font));
                    }
                    totalWidth = itemWidth + maxWidth;
                }
                totalHeight -= itemGap;
            }
            var padding = this.reformCssArray(this.dataRangeOption.padding);
            var x;
            var zrWidth = this.zr.getWidth();
            switch (this.dataRangeOption.x) {
            case 'center':
                x = Math.floor((zrWidth - totalWidth) / 2);
                break;
            case 'left':
                x = padding[3] + this.dataRangeOption.borderWidth;
                break;
            case 'right':
                x = zrWidth - totalWidth - padding[1] - this.dataRangeOption.borderWidth;
                break;
            default:
                x = this.parsePercent(this.dataRangeOption.x, zrWidth);
                x = isNaN(x) ? 0 : x;
                break;
            }
            var y;
            var zrHeight = this.zr.getHeight();
            switch (this.dataRangeOption.y) {
            case 'top':
                y = padding[0] + this.dataRangeOption.borderWidth;
                break;
            case 'bottom':
                y = zrHeight - totalHeight - padding[2] - this.dataRangeOption.borderWidth;
                break;
            case 'center':
                y = Math.floor((zrHeight - totalHeight) / 2);
                break;
            default:
                y = this.parsePercent(this.dataRangeOption.y, zrHeight);
                y = isNaN(y) ? 0 : y;
                break;
            }
            if (this.dataRangeOption.calculable) {
                var handlerWidth = Math.max(zrArea.getTextWidth(this.dataRangeOption.max, font), zrArea.getTextWidth(this.dataRangeOption.min, font)) + textHeight;
                if (this.dataRangeOption.orient == 'horizontal') {
                    if (x < handlerWidth) {
                        x = handlerWidth;
                    }
                    if (x + totalWidth + handlerWidth > zrWidth) {
                        x -= handlerWidth;
                    }
                } else {
                    if (y < textHeight) {
                        y = textHeight;
                    }
                    if (y + totalHeight + textHeight > zrHeight) {
                        y -= textHeight;
                    }
                }
            }
            return {
                x: x,
                y: y,
                width: totalWidth,
                height: totalHeight
            };
        },
        _getTextShape: function (x, y, text) {
            return {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: this.dataRangeOption.orient == 'horizontal' ? x : this._itemGroupLocation.x + this._itemGroupLocation.width / 2,
                    y: this.dataRangeOption.orient == 'horizontal' ? this._itemGroupLocation.y + this._itemGroupLocation.height / 2 : y,
                    color: this.dataRangeOption.textStyle.color,
                    text: text,
                    textFont: this.getFont(this.dataRangeOption.textStyle),
                    textBaseline: this.dataRangeOption.orient == 'horizontal' ? 'middle' : 'top',
                    textAlign: this.dataRangeOption.orient == 'horizontal' ? 'left' : 'center'
                },
                hoverable: false
            };
        },
        _getItemShape: function (x, y, width, height, color) {
            return {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,
                    y: y + 1,
                    width: width,
                    height: height - 2,
                    color: color
                },
                highlightStyle: {
                    strokeColor: color,
                    lineWidth: 1
                }
            };
        },
        __ondrift: function (shape, dx, dy) {
            var x = this._calculableLocation.x;
            var y = this._calculableLocation.y;
            var width = this._calculableLocation.width;
            var height = this._calculableLocation.height;
            if (this.dataRangeOption.orient == 'horizontal') {
                if (shape.style.x + dx <= x) {
                    shape.style.x = x;
                } else if (shape.style.x + dx + shape.style.width >= x + width) {
                    shape.style.x = x + width - shape.style.width;
                } else {
                    shape.style.x += dx;
                }
            } else {
                if (shape.style.y + dy <= y) {
                    shape.style.y = y;
                } else if (shape.style.y + dy + shape.style.height >= y + height) {
                    shape.style.y = y + height - shape.style.height;
                } else {
                    shape.style.y += dy;
                }
            }
            if (shape._type == 'filler') {
                this._syncHandleShape();
            } else {
                this._syncFillerShape(shape);
            }
            if (this.dataRangeOption.realtime) {
                this._dispatchDataRange();
            }
            return true;
        },
        __ondragend: function () {
            this.isDragend = true;
        },
        ondragend: function (param, status) {
            if (!this.isDragend || !param.target) {
                return;
            }
            status.dragOut = true;
            status.dragIn = true;
            if (!this.dataRangeOption.realtime) {
                this._dispatchDataRange();
            }
            status.needRefresh = false;
            this.isDragend = false;
            return;
        },
        _syncShapeFromRange: function () {
            var range = this.dataRangeOption.range || {};
            var optRangeStart = range.start;
            var optRangeEnd = range.end;
            if (optRangeEnd < optRangeStart) {
                optRangeStart = [
                    optRangeEnd,
                    optRangeEnd = optRangeStart
                ][0];
            }
            this._range.end = optRangeStart != null ? optRangeStart : this._range.end != null ? this._range.end : 0;
            this._range.start = optRangeEnd != null ? optRangeEnd : this._range.start != null ? this._range.start : 100;
            if (this._range.start != 100 || this._range.end !== 0) {
                if (this.dataRangeOption.orient == 'horizontal') {
                    var width = this._fillerShape.style.width;
                    this._fillerShape.style.x += width * (100 - this._range.start) / 100;
                    this._fillerShape.style.width = width * (this._range.start - this._range.end) / 100;
                } else {
                    var height = this._fillerShape.style.height;
                    this._fillerShape.style.y += height * (100 - this._range.start) / 100;
                    this._fillerShape.style.height = height * (this._range.start - this._range.end) / 100;
                }
                this.zr.modShape(this._fillerShape.id);
                this._syncHandleShape();
            }
        },
        _syncHandleShape: function () {
            var x = this._calculableLocation.x;
            var y = this._calculableLocation.y;
            var width = this._calculableLocation.width;
            var height = this._calculableLocation.height;
            if (this.dataRangeOption.orient == 'horizontal') {
                this._startShape.style.x = this._fillerShape.style.x;
                this._startMask.style.width = this._startShape.style.x - x;
                this._endShape.style.x = this._fillerShape.style.x + this._fillerShape.style.width;
                this._endMask.style.x = this._endShape.style.x;
                this._endMask.style.width = x + width - this._endShape.style.x;
                this._range.start = Math.ceil(100 - (this._startShape.style.x - x) / width * 100);
                this._range.end = Math.floor(100 - (this._endShape.style.x - x) / width * 100);
            } else {
                this._startShape.style.y = this._fillerShape.style.y;
                this._startMask.style.height = this._startShape.style.y - y;
                this._endShape.style.y = this._fillerShape.style.y + this._fillerShape.style.height;
                this._endMask.style.y = this._endShape.style.y;
                this._endMask.style.height = y + height - this._endShape.style.y;
                this._range.start = Math.ceil(100 - (this._startShape.style.y - y) / height * 100);
                this._range.end = Math.floor(100 - (this._endShape.style.y - y) / height * 100);
            }
            this._syncShape();
        },
        _syncFillerShape: function (e) {
            var x = this._calculableLocation.x;
            var y = this._calculableLocation.y;
            var width = this._calculableLocation.width;
            var height = this._calculableLocation.height;
            var a;
            var b;
            if (this.dataRangeOption.orient == 'horizontal') {
                a = this._startShape.style.x;
                b = this._endShape.style.x;
                if (e.id == this._startShape.id && a >= b) {
                    b = a;
                    this._endShape.style.x = a;
                } else if (e.id == this._endShape.id && a >= b) {
                    a = b;
                    this._startShape.style.x = a;
                }
                this._fillerShape.style.x = a;
                this._fillerShape.style.width = b - a;
                this._startMask.style.width = a - x;
                this._endMask.style.x = b;
                this._endMask.style.width = x + width - b;
                this._range.start = Math.ceil(100 - (a - x) / width * 100);
                this._range.end = Math.floor(100 - (b - x) / width * 100);
            } else {
                a = this._startShape.style.y;
                b = this._endShape.style.y;
                if (e.id == this._startShape.id && a >= b) {
                    b = a;
                    this._endShape.style.y = a;
                } else if (e.id == this._endShape.id && a >= b) {
                    a = b;
                    this._startShape.style.y = a;
                }
                this._fillerShape.style.y = a;
                this._fillerShape.style.height = b - a;
                this._startMask.style.height = a - y;
                this._endMask.style.y = b;
                this._endMask.style.height = y + height - b;
                this._range.start = Math.ceil(100 - (a - y) / height * 100);
                this._range.end = Math.floor(100 - (b - y) / height * 100);
            }
            this._syncShape();
        },
        _syncShape: function () {
            this._startShape.position = [
                this._startShape.style.x - this._startShape.style._x,
                this._startShape.style.y - this._startShape.style._y
            ];
            this._startShape.style.text = this._textFormat(this._gap * this._range.start + this.dataRangeOption.min);
            this._startShape.style.color = this._startShape.highlightStyle.strokeColor = this.getColor(this._gap * this._range.start + this.dataRangeOption.min);
            this._endShape.position = [
                this._endShape.style.x - this._endShape.style._x,
                this._endShape.style.y - this._endShape.style._y
            ];
            this._endShape.style.text = this._textFormat(this._gap * this._range.end + this.dataRangeOption.min);
            this._endShape.style.color = this._endShape.highlightStyle.strokeColor = this.getColor(this._gap * this._range.end + this.dataRangeOption.min);
            this.zr.modShape(this._startShape.id);
            this.zr.modShape(this._endShape.id);
            this.zr.modShape(this._startMask.id);
            this.zr.modShape(this._endMask.id);
            this.zr.modShape(this._fillerShape.id);
            this.zr.refreshNextFrame();
        },
        _dispatchDataRange: function () {
            this.messageCenter.dispatch(ecConfig.EVENT.DATA_RANGE, null, {
                range: {
                    start: this._range.end,
                    end: this._range.start
                }
            }, this.myChart);
        },
        __dataRangeSelected: function (param) {
            if (this.dataRangeOption.selectedMode === 'single') {
                for (var k in this._selectedMap) {
                    this._selectedMap[k] = false;
                }
            }
            var idx = param.target._idx;
            this._selectedMap[idx] = !this._selectedMap[idx];
            var valueMax;
            var valueMin;
            if (this._useCustomizedSplit()) {
                valueMax = this._splitList[idx].max;
                valueMin = this._splitList[idx].min;
            } else {
                valueMax = (this._colorList.length - idx) * this._gap + this.dataRangeOption.min;
                valueMin = valueMax - this._gap;
            }
            this.messageCenter.dispatch(ecConfig.EVENT.DATA_RANGE_SELECTED, param.event, {
                selected: this._selectedMap,
                target: idx,
                valueMax: valueMax,
                valueMin: valueMin
            }, this.myChart);
            this.messageCenter.dispatch(ecConfig.EVENT.REFRESH, null, null, this.myChart);
        },
        __dispatchHoverLink: function (param) {
            var valueMin;
            var valueMax;
            if (this.dataRangeOption.calculable) {
                var totalValue = this.dataRangeOption.max - this.dataRangeOption.min;
                var curValue;
                if (this.dataRangeOption.orient == 'horizontal') {
                    curValue = (1 - (zrEvent.getX(param.event) - this._calculableLocation.x) / this._calculableLocation.width) * totalValue;
                } else {
                    curValue = (1 - (zrEvent.getY(param.event) - this._calculableLocation.y) / this._calculableLocation.height) * totalValue;
                }
                valueMin = curValue - totalValue * 0.05;
                valueMax = curValue + totalValue * 0.05;
            } else if (this._useCustomizedSplit()) {
                var idx = param.target._idx;
                valueMax = this._splitList[idx].max;
                valueMin = this._splitList[idx].min;
            } else {
                var idx = param.target._idx;
                valueMax = (this._colorList.length - idx) * this._gap + this.dataRangeOption.min;
                valueMin = valueMax - this._gap;
            }
            this.messageCenter.dispatch(ecConfig.EVENT.DATA_RANGE_HOVERLINK, param.event, {
                valueMin: valueMin,
                valueMax: valueMax
            }, this.myChart);
        },
        __onhoverlink: function (param) {
            if (this.dataRangeOption.show && this.dataRangeOption.hoverLink && this._indicatorShape && param && param.seriesIndex != null && param.dataIndex != null) {
                var curValue = param.value;
                if (curValue === '' || isNaN(curValue)) {
                    return;
                }
                if (curValue < this.dataRangeOption.min) {
                    curValue = this.dataRangeOption.min;
                } else if (curValue > this.dataRangeOption.max) {
                    curValue = this.dataRangeOption.max;
                }
                if (this.dataRangeOption.orient == 'horizontal') {
                    this._indicatorShape.position = [
                        (this.dataRangeOption.max - curValue) / (this.dataRangeOption.max - this.dataRangeOption.min) * this._calculableLocation.width,
                        0
                    ];
                } else {
                    this._indicatorShape.position = [
                        0,
                        (this.dataRangeOption.max - curValue) / (this.dataRangeOption.max - this.dataRangeOption.min) * this._calculableLocation.height
                    ];
                }
                this._indicatorShape.style.text = this._textFormat(param.value);
                this._indicatorShape.style.color = this.getColor(curValue);
                this.zr.addHoverShape(this._indicatorShape);
            }
        },
        _textFormat: function (valueStart, valueEnd) {
            var dataRangeOption = this.dataRangeOption;
            if (valueStart !== -Number.MAX_VALUE) {
                valueStart = (+valueStart).toFixed(dataRangeOption.precision);
            }
            if (valueEnd != null && valueEnd !== Number.MAX_VALUE) {
                valueEnd = (+valueEnd).toFixed(dataRangeOption.precision);
            }
            if (dataRangeOption.formatter) {
                if (typeof dataRangeOption.formatter == 'string') {
                    return dataRangeOption.formatter.replace('{value}', valueStart === -Number.MAX_VALUE ? 'min' : valueStart).replace('{value2}', valueEnd === Number.MAX_VALUE ? 'max' : valueEnd);
                } else if (typeof dataRangeOption.formatter == 'function') {
                    return dataRangeOption.formatter.call(this.myChart, valueStart, valueEnd);
                }
            }
            if (valueEnd == null) {
                return valueStart;
            } else {
                if (valueStart === -Number.MAX_VALUE) {
                    return '< ' + valueEnd;
                } else if (valueEnd === Number.MAX_VALUE) {
                    return '> ' + valueStart;
                } else {
                    return valueStart + ' - ' + valueEnd;
                }
            }
        },
        _isContinuity: function () {
            var dataRangeOption = this.dataRangeOption;
            return !(dataRangeOption.splitList ? dataRangeOption.splitList.length > 0 : dataRangeOption.splitNumber > 0) || dataRangeOption.calculable;
        },
        _useCustomizedSplit: function () {
            var dataRangeOption = this.dataRangeOption;
            return dataRangeOption.splitList && dataRangeOption.splitList.length > 0;
        },
        _buildColorList: function (splitNumber) {
            this._colorList = zrColor.getGradientColors(this.dataRangeOption.color, Math.max((splitNumber - this.dataRangeOption.color.length) / (this.dataRangeOption.color.length - 1), 0) + 1);
            if (this._colorList.length > splitNumber) {
                var len = this._colorList.length;
                var newColorList = [this._colorList[0]];
                var step = len / (splitNumber - 1);
                for (var i = 1; i < splitNumber - 1; i++) {
                    newColorList.push(this._colorList[Math.floor(i * step)]);
                }
                newColorList.push(this._colorList[len - 1]);
                this._colorList = newColorList;
            }
            if (this._useCustomizedSplit()) {
                var splitList = this._splitList;
                for (var i = 0, len = splitList.length; i < len; i++) {
                    if (splitList[i].color) {
                        this._colorList[i] = splitList[i].color;
                    }
                }
            }
        },
        _buildGap: function (splitNumber) {
            if (!this._useCustomizedSplit()) {
                var precision = this.dataRangeOption.precision;
                this._gap = (this.dataRangeOption.max - this.dataRangeOption.min) / splitNumber;
                while (this._gap.toFixed(precision) - 0 != this._gap && precision < 5) {
                    precision++;
                }
                this.dataRangeOption.precision = precision;
                this._gap = ((this.dataRangeOption.max - this.dataRangeOption.min) / splitNumber).toFixed(precision) - 0;
            }
        },
        _buildDataList: function (splitNumber) {
            var valueTextList = this._valueTextList = [];
            var dataRangeOption = this.dataRangeOption;
            var useCustomizedSplit = this._useCustomizedSplit();
            for (var i = 0; i < splitNumber; i++) {
                this._selectedMap[i] = true;
                var text = '';
                if (useCustomizedSplit) {
                    var splitListItem = this._splitList[splitNumber - 1 - i];
                    if (splitListItem.label != null) {
                        text = splitListItem.label;
                    } else if (splitListItem.single != null) {
                        text = this._textFormat(splitListItem.single);
                    } else {
                        text = this._textFormat(splitListItem.min, splitListItem.max);
                    }
                } else {
                    text = this._textFormat(i * this._gap + dataRangeOption.min, (i + 1) * this._gap + dataRangeOption.min);
                }
                valueTextList.unshift(text);
            }
        },
        _buildSplitList: function () {
            if (!this._useCustomizedSplit()) {
                return;
            }
            var splitList = this.dataRangeOption.splitList;
            var splitRangeList = this._splitList = [];
            for (var i = 0, len = splitList.length; i < len; i++) {
                var splitListItem = splitList[i];
                if (!splitListItem || splitListItem.start == null && splitListItem.end == null) {
                    throw new Error('Empty item exists in splitList!');
                }
                var reformedItem = {
                    label: splitListItem.label,
                    color: splitListItem.color
                };
                reformedItem.min = splitListItem.start;
                reformedItem.max = splitListItem.end;
                if (reformedItem.min > reformedItem.max) {
                    reformedItem.min = [
                        reformedItem.max,
                        reformedItem.max = reformedItem.min
                    ][0];
                }
                if (reformedItem.min === reformedItem.max) {
                    reformedItem.single = reformedItem.max;
                }
                if (reformedItem.min == null) {
                    reformedItem.min = -Number.MAX_VALUE;
                }
                if (reformedItem.max == null) {
                    reformedItem.max = Number.MAX_VALUE;
                }
                splitRangeList.push(reformedItem);
            }
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;
                this.option.dataRange = this.reformOption(this.option.dataRange);
                var dataRangeOption = this.dataRangeOption = this.option.dataRange;
                if (!this._useCustomizedSplit() && (dataRangeOption.min == null || dataRangeOption.max == null)) {
                    throw new Error('option.dataRange.min or option.dataRange.max has not been defined.');
                }
                if (!this.myChart.canvasSupported) {
                    dataRangeOption.realtime = false;
                }
                var splitNumber = this._isContinuity() ? 100 : this._useCustomizedSplit() ? dataRangeOption.splitList.length : dataRangeOption.splitNumber;
                this._buildSplitList();
                this._buildColorList(splitNumber);
                this._buildGap(splitNumber);
                this._buildDataList(splitNumber);
            }
            this.clear();
            this._buildShape();
        },
        getColor: function (value) {
            if (isNaN(value)) {
                return null;
            }
            var idx;
            if (!this._useCustomizedSplit()) {
                if (this.dataRangeOption.min == this.dataRangeOption.max) {
                    return this._colorList[0];
                }
                if (value < this.dataRangeOption.min) {
                    value = this.dataRangeOption.min;
                } else if (value > this.dataRangeOption.max) {
                    value = this.dataRangeOption.max;
                }
                if (this.dataRangeOption.calculable) {
                    if (value - (this._gap * this._range.start + this.dataRangeOption.min) > 0.00005 || value - (this._gap * this._range.end + this.dataRangeOption.min) < -0.00005) {
                        return null;
                    }
                }
                idx = this._colorList.length - Math.ceil((value - this.dataRangeOption.min) / (this.dataRangeOption.max - this.dataRangeOption.min) * this._colorList.length);
                if (idx == this._colorList.length) {
                    idx--;
                }
            } else {
                var splitRangeList = this._splitList;
                for (var i = 0, len = splitRangeList.length; i < len; i++) {
                    if (splitRangeList[i].min <= value && splitRangeList[i].max >= value) {
                        idx = i;
                        break;
                    }
                }
            }
            if (this._selectedMap[idx]) {
                return this._colorList[idx];
            } else {
                return null;
            }
        },
        getColorByIndex: function (idx) {
            if (idx >= this._colorList.length) {
                idx = this._colorList.length - 1;
            } else if (idx < 0) {
                idx = 0;
            }
            return this._colorList[idx];
        },
        onbeforDispose: function () {
            this.messageCenter.unbind(ecConfig.EVENT.HOVER, this._onhoverlink);
        }
    };
    zrUtil.inherits(DataRange, Base);
    require('../component').define('dataRange', DataRange);
    return DataRange;
});define('echarts/component/roamController', [
    'require',
    './base',
    'zrender/shape/Rectangle',
    'zrender/shape/Sector',
    'zrender/shape/Circle',
    '../config',
    'zrender/tool/util',
    'zrender/tool/color',
    'zrender/tool/event',
    '../component'
], function (require) {
    var Base = require('./base');
    var RectangleShape = require('zrender/shape/Rectangle');
    var SectorShape = require('zrender/shape/Sector');
    var CircleShape = require('zrender/shape/Circle');
    var ecConfig = require('../config');
    ecConfig.roamController = {
        zlevel: 0,
        z: 4,
        show: true,
        x: 'left',
        y: 'top',
        width: 80,
        height: 120,
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',
        borderWidth: 0,
        padding: 5,
        handleColor: '#6495ed',
        fillerColor: '#fff',
        step: 15,
        mapTypeControl: null
    };
    var zrUtil = require('zrender/tool/util');
    var zrColor = require('zrender/tool/color');
    var zrEvent = require('zrender/tool/event');
    function RoamController(ecTheme, messageCenter, zr, option, myChart) {
        this.rcOption = {};
        if (!option.roamController || !option.roamController.show) {
            return;
        }
        if (!option.roamController.mapTypeControl) {
            console.error('option.roamController.mapTypeControl has not been defined.');
            return;
        }
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        this.rcOption = option.roamController;
        var self = this;
        this._drictionMouseDown = function (params) {
            return self.__drictionMouseDown(params);
        };
        this._drictionMouseUp = function (params) {
            return self.__drictionMouseUp(params);
        };
        this._drictionMouseMove = function (params) {
            return self.__drictionMouseMove(params);
        };
        this._drictionMouseOut = function (params) {
            return self.__drictionMouseOut(params);
        };
        this._scaleHandler = function (params) {
            return self.__scaleHandler(params);
        };
        this.refresh(option);
    }
    RoamController.prototype = {
        type: ecConfig.COMPONENT_TYPE_ROAMCONTROLLER,
        _buildShape: function () {
            if (!this.rcOption.show) {
                return;
            }
            this._itemGroupLocation = this._getItemGroupLocation();
            this._buildBackground();
            this._buildItem();
            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.addShape(this.shapeList[i]);
            }
        },
        _buildItem: function () {
            this.shapeList.push(this._getDirectionShape('up'));
            this.shapeList.push(this._getDirectionShape('down'));
            this.shapeList.push(this._getDirectionShape('left'));
            this.shapeList.push(this._getDirectionShape('right'));
            this.shapeList.push(this._getScaleShape('scaleUp'));
            this.shapeList.push(this._getScaleShape('scaleDown'));
        },
        _getDirectionShape: function (direction) {
            var r = this._itemGroupLocation.r;
            var x = this._itemGroupLocation.x + r;
            var y = this._itemGroupLocation.y + r;
            var sectorShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,
                    y: y,
                    r: r,
                    startAngle: -45,
                    endAngle: 45,
                    color: this.rcOption.handleColor,
                    text: '>',
                    textX: x + r / 2 + 4,
                    textY: y - 0.5,
                    textAlign: 'center',
                    textBaseline: 'middle',
                    textPosition: 'specific',
                    textColor: this.rcOption.fillerColor,
                    textFont: Math.floor(r / 2) + 'px arial'
                },
                highlightStyle: {
                    color: zrColor.lift(this.rcOption.handleColor, -0.2),
                    brushType: 'fill'
                },
                clickable: true
            };
            switch (direction) {
            case 'up':
                sectorShape.rotation = [
                    Math.PI / 2,
                    x,
                    y
                ];
                break;
            case 'left':
                sectorShape.rotation = [
                    Math.PI,
                    x,
                    y
                ];
                break;
            case 'down':
                sectorShape.rotation = [
                    -Math.PI / 2,
                    x,
                    y
                ];
                break;
            }
            sectorShape = new SectorShape(sectorShape);
            sectorShape._roamType = direction;
            sectorShape.onmousedown = this._drictionMouseDown;
            sectorShape.onmouseup = this._drictionMouseUp;
            sectorShape.onmousemove = this._drictionMouseMove;
            sectorShape.onmouseout = this._drictionMouseOut;
            return sectorShape;
        },
        _getScaleShape: function (text) {
            var width = this._itemGroupLocation.width;
            var height = this._itemGroupLocation.height - width;
            height = height < 0 ? 20 : height;
            var r = Math.min(width / 2 - 5, height) / 2;
            var x = this._itemGroupLocation.x + (text === 'scaleDown' ? width - r : r);
            var y = this._itemGroupLocation.y + this._itemGroupLocation.height - r;
            var scaleShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    x: x,
                    y: y,
                    r: r,
                    color: this.rcOption.handleColor,
                    text: text === 'scaleDown' ? '-' : '+',
                    textX: x,
                    textY: y - 2,
                    textAlign: 'center',
                    textBaseline: 'middle',
                    textPosition: 'specific',
                    textColor: this.rcOption.fillerColor,
                    textFont: Math.floor(r) + 'px verdana'
                },
                highlightStyle: {
                    color: zrColor.lift(this.rcOption.handleColor, -0.2),
                    brushType: 'fill'
                },
                clickable: true
            };
            scaleShape = new CircleShape(scaleShape);
            scaleShape._roamType = text;
            scaleShape.onmousedown = this._scaleHandler;
            return scaleShape;
        },
        _buildBackground: function () {
            var padding = this.reformCssArray(this.rcOption.padding);
            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable: false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: this.rcOption.borderWidth === 0 ? 'fill' : 'both',
                    color: this.rcOption.backgroundColor,
                    strokeColor: this.rcOption.borderColor,
                    lineWidth: this.rcOption.borderWidth
                }
            }));
        },
        _getItemGroupLocation: function () {
            var padding = this.reformCssArray(this.rcOption.padding);
            var width = this.rcOption.width;
            var height = this.rcOption.height;
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            var x;
            switch (this.rcOption.x) {
            case 'center':
                x = Math.floor((zrWidth - width) / 2);
                break;
            case 'left':
                x = padding[3] + this.rcOption.borderWidth;
                break;
            case 'right':
                x = zrWidth - width - padding[1] - padding[3] - this.rcOption.borderWidth * 2;
                break;
            default:
                x = this.parsePercent(this.rcOption.x, zrWidth);
                break;
            }
            var y;
            switch (this.rcOption.y) {
            case 'top':
                y = padding[0] + this.rcOption.borderWidth;
                break;
            case 'bottom':
                y = zrHeight - height - padding[0] - padding[2] - this.rcOption.borderWidth * 2;
                break;
            case 'center':
                y = Math.floor((zrHeight - height) / 2);
                break;
            default:
                y = this.parsePercent(this.rcOption.y, zrHeight);
                break;
            }
            return {
                x: x,
                y: y,
                r: width / 2,
                width: width,
                height: height
            };
        },
        __drictionMouseDown: function (params) {
            this.mousedown = true;
            this._drictionHandlerOn(params);
        },
        __drictionMouseUp: function (params) {
            this.mousedown = false;
            this._drictionHandlerOff(params);
        },
        __drictionMouseMove: function (params) {
            if (this.mousedown) {
                this._drictionHandlerOn(params);
            }
        },
        __drictionMouseOut: function (params) {
            this._drictionHandlerOff(params);
        },
        _drictionHandlerOn: function (params) {
            this._dispatchEvent(params.event, params.target._roamType);
            clearInterval(this.dircetionTimer);
            var self = this;
            this.dircetionTimer = setInterval(function () {
                self._dispatchEvent(params.event, params.target._roamType);
            }, 100);
            zrEvent.stop(params.event);
        },
        _drictionHandlerOff: function (params) {
            clearInterval(this.dircetionTimer);
        },
        __scaleHandler: function (params) {
            this._dispatchEvent(params.event, params.target._roamType);
            zrEvent.stop(params.event);
        },
        _dispatchEvent: function (event, roamType) {
            this.messageCenter.dispatch(ecConfig.EVENT.ROAMCONTROLLER, event, {
                roamType: roamType,
                mapTypeControl: this.rcOption.mapTypeControl,
                step: this.rcOption.step
            }, this.myChart);
        },
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption || this.option;
                this.option.roamController = this.reformOption(this.option.roamController);
                this.rcOption = this.option.roamController;
            }
            this.clear();
            this._buildShape();
        }
    };
    zrUtil.inherits(RoamController, Base);
    require('../component').define('roamController', RoamController);
    return RoamController;
});define('echarts/layer/heatmap', ['require'], function (require) {
    var defaultOptions = {
        blurSize: 30,
        gradientColors: [
            'blue',
            'cyan',
            'lime',
            'yellow',
            'red'
        ],
        minAlpha: 0.05,
        valueScale: 1,
        opacity: 1
    };
    var BRUSH_SIZE = 20;
    var GRADIENT_LEVELS = 256;
    function Heatmap(opt) {
        this.option = opt;
        if (opt) {
            for (var i in defaultOptions) {
                if (opt[i] !== undefined) {
                    this.option[i] = opt[i];
                } else {
                    this.option[i] = defaultOptions[i];
                }
            }
        } else {
            this.option = defaultOptions;
        }
    }
    Heatmap.prototype = {
        getCanvas: function (data, width, height) {
            var brush = this._getBrush();
            var gradient = this._getGradient();
            var r = BRUSH_SIZE + this.option.blurSize;
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            var len = data.length;
            for (var i = 0; i < len; ++i) {
                var p = data[i];
                var x = p[0];
                var y = p[1];
                var value = p[2];
                var alpha = Math.min(1, Math.max(value * this.option.valueScale || this.option.minAlpha, this.option.minAlpha));
                ctx.globalAlpha = alpha;
                ctx.drawImage(brush, x - r, y - r);
            }
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var pixels = imageData.data;
            var len = pixels.length / 4;
            while (len--) {
                var id = len * 4 + 3;
                var alpha = pixels[id] / 256;
                var colorOffset = Math.floor(alpha * (GRADIENT_LEVELS - 1));
                pixels[id - 3] = gradient[colorOffset * 4];
                pixels[id - 2] = gradient[colorOffset * 4 + 1];
                pixels[id - 1] = gradient[colorOffset * 4 + 2];
                pixels[id] *= this.option.opacity;
            }
            ctx.putImageData(imageData, 0, 0);
            return canvas;
        },
        _getBrush: function () {
            if (!this._brushCanvas) {
                this._brushCanvas = document.createElement('canvas');
                var r = BRUSH_SIZE + this.option.blurSize;
                var d = r * 2;
                this._brushCanvas.width = d;
                this._brushCanvas.height = d;
                var ctx = this._brushCanvas.getContext('2d');
                ctx.shadowOffsetX = d;
                ctx.shadowBlur = this.option.blurSize;
                ctx.shadowColor = 'black';
                ctx.beginPath();
                ctx.arc(-r, r, BRUSH_SIZE, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fill();
            }
            return this._brushCanvas;
        },
        _getGradient: function () {
            if (!this._gradientPixels) {
                var levels = GRADIENT_LEVELS;
                var canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = levels;
                var ctx = canvas.getContext('2d');
                var gradient = ctx.createLinearGradient(0, 0, 0, levels);
                var len = this.option.gradientColors.length;
                for (var i = 0; i < len; ++i) {
                    if (typeof this.option.gradientColors[i] === 'string') {
                        gradient.addColorStop((i + 1) / len, this.option.gradientColors[i]);
                    } else {
                        gradient.addColorStop(this.option.gradientColors[i].offset, this.option.gradientColors[i].color);
                    }
                }
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 1, levels);
                this._gradientPixels = ctx.getImageData(0, 0, 1, levels).data;
            }
            return this._gradientPixels;
        }
    };
    return Heatmap;
});define('echarts/util/mapData/params', ['require'], function (require) {
    function decode(json) {
        if (!json.UTF8Encoding) {
            return json;
        }
        var features = json.features;
        for (var f = 0; f < features.length; f++) {
            var feature = features[f];
            var coordinates = feature.geometry.coordinates;
            var encodeOffsets = feature.geometry.encodeOffsets;
            for (var c = 0; c < coordinates.length; c++) {
                var coordinate = coordinates[c];
                if (feature.geometry.type === 'Polygon') {
                    coordinates[c] = decodePolygon(coordinate, encodeOffsets[c]);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    for (var c2 = 0; c2 < coordinate.length; c2++) {
                        var polygon = coordinate[c2];
                        coordinate[c2] = decodePolygon(polygon, encodeOffsets[c][c2]);
                    }
                }
            }
        }
        json.UTF8Encoding = false;
        return json;
    }
    function decodePolygon(coordinate, encodeOffsets) {
        var result = [];
        var prevX = encodeOffsets[0];
        var prevY = encodeOffsets[1];
        for (var i = 0; i < coordinate.length; i += 2) {
            var x = coordinate.charCodeAt(i) - 64;
            var y = coordinate.charCodeAt(i + 1) - 64;
            x = x >> 1 ^ -(x & 1);
            y = y >> 1 ^ -(y & 1);
            x += prevX;
            y += prevY;
            prevX = x;
            prevY = y;
            result.push([
                x / 1024,
                y / 1024
            ]);
        }
        return result;
    }
    var mapParams = {
        'none': {
            getGeoJson: function (callback) {
                callback({
                    type: 'FeatureCollection',
                    features: [{
                            type: 'Feature',
                            geometry: {
                                coordinates: [],
                                encodeOffsets: [],
                                type: 'Polygon'
                            },
                            properties: {}
                        }]
                });
            }
        },
        'world': {
            getGeoJson: function (callback) {
                require(['./geoJson/world_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        'china': {
            getGeoJson: function (callback) {
                require(['./geoJson/china_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '南海诸岛': {
            textCoord: [
                126,
                25
            ],
            getPath: function (leftTop, scale) {
                var pList = [
                    [
                        [
                            0,
                            3.5
                        ],
                        [
                            7,
                            11.2
                        ],
                        [
                            15,
                            11.9
                        ],
                        [
                            30,
                            7
                        ],
                        [
                            42,
                            0.7
                        ],
                        [
                            52,
                            0.7
                        ],
                        [
                            56,
                            7.7
                        ],
                        [
                            59,
                            0.7
                        ],
                        [
                            64,
                            0.7
                        ],
                        [
                            64,
                            0
                        ],
                        [
                            5,
                            0
                        ],
                        [
                            0,
                            3.5
                        ]
                    ],
                    [
                        [
                            13,
                            16.1
                        ],
                        [
                            19,
                            14.7
                        ],
                        [
                            16,
                            21.7
                        ],
                        [
                            11,
                            23.1
                        ],
                        [
                            13,
                            16.1
                        ]
                    ],
                    [
                        [
                            12,
                            32.2
                        ],
                        [
                            14,
                            38.5
                        ],
                        [
                            15,
                            38.5
                        ],
                        [
                            13,
                            32.2
                        ],
                        [
                            12,
                            32.2
                        ]
                    ],
                    [
                        [
                            16,
                            47.6
                        ],
                        [
                            12,
                            53.2
                        ],
                        [
                            13,
                            53.2
                        ],
                        [
                            18,
                            47.6
                        ],
                        [
                            16,
                            47.6
                        ]
                    ],
                    [
                        [
                            6,
                            64.4
                        ],
                        [
                            8,
                            70
                        ],
                        [
                            9,
                            70
                        ],
                        [
                            8,
                            64.4
                        ],
                        [
                            6,
                            64.4
                        ]
                    ],
                    [
                        [
                            23,
                            82.6
                        ],
                        [
                            29,
                            79.8
                        ],
                        [
                            30,
                            79.8
                        ],
                        [
                            25,
                            82.6
                        ],
                        [
                            23,
                            82.6
                        ]
                    ],
                    [
                        [
                            37,
                            70.7
                        ],
                        [
                            43,
                            62.3
                        ],
                        [
                            44,
                            62.3
                        ],
                        [
                            39,
                            70.7
                        ],
                        [
                            37,
                            70.7
                        ]
                    ],
                    [
                        [
                            48,
                            51.1
                        ],
                        [
                            51,
                            45.5
                        ],
                        [
                            53,
                            45.5
                        ],
                        [
                            50,
                            51.1
                        ],
                        [
                            48,
                            51.1
                        ]
                    ],
                    [
                        [
                            51,
                            35
                        ],
                        [
                            51,
                            28.7
                        ],
                        [
                            53,
                            28.7
                        ],
                        [
                            53,
                            35
                        ],
                        [
                            51,
                            35
                        ]
                    ],
                    [
                        [
                            52,
                            22.4
                        ],
                        [
                            55,
                            17.5
                        ],
                        [
                            56,
                            17.5
                        ],
                        [
                            53,
                            22.4
                        ],
                        [
                            52,
                            22.4
                        ]
                    ],
                    [
                        [
                            58,
                            12.6
                        ],
                        [
                            62,
                            7
                        ],
                        [
                            63,
                            7
                        ],
                        [
                            60,
                            12.6
                        ],
                        [
                            58,
                            12.6
                        ]
                    ],
                    [
                        [
                            0,
                            3.5
                        ],
                        [
                            0,
                            93.1
                        ],
                        [
                            64,
                            93.1
                        ],
                        [
                            64,
                            0
                        ],
                        [
                            63,
                            0
                        ],
                        [
                            63,
                            92.4
                        ],
                        [
                            1,
                            92.4
                        ],
                        [
                            1,
                            3.5
                        ],
                        [
                            0,
                            3.5
                        ]
                    ]
                ];
                var str = '';
                var left = leftTop[0];
                var top = leftTop[1];
                for (var i = 0, l = pList.length; i < l; i++) {
                    str += 'M ' + ((pList[i][0][0] * scale + left).toFixed(2) - 0) + ' ' + ((pList[i][0][1] * scale + top).toFixed(2) - 0) + ' ';
                    for (var j = 1, k = pList[i].length; j < k; j++) {
                        str += 'L ' + ((pList[i][j][0] * scale + left).toFixed(2) - 0) + ' ' + ((pList[i][j][1] * scale + top).toFixed(2) - 0) + ' ';
                    }
                }
                return str + ' Z';
            }
        },
        '新疆': {
            getGeoJson: function (callback) {
                require(['./geoJson/xin_jiang_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '西藏': {
            getGeoJson: function (callback) {
                require(['./geoJson/xi_zang_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '内蒙古': {
            getGeoJson: function (callback) {
                require(['./geoJson/nei_meng_gu_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '青海': {
            getGeoJson: function (callback) {
                require(['./geoJson/qing_hai_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '四川': {
            getGeoJson: function (callback) {
                require(['./geoJson/si_chuan_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '黑龙江': {
            getGeoJson: function (callback) {
                require(['./geoJson/hei_long_jiang_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '甘肃': {
            getGeoJson: function (callback) {
                require(['./geoJson/gan_su_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '云南': {
            getGeoJson: function (callback) {
                require(['./geoJson/yun_nan_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '广西': {
            getGeoJson: function (callback) {
                require(['./geoJson/guang_xi_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '湖南': {
            getGeoJson: function (callback) {
                require(['./geoJson/hu_nan_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '陕西': {
            getGeoJson: function (callback) {
                require(['./geoJson/shan_xi_1_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '广东': {
            getGeoJson: function (callback) {
                require(['./geoJson/guang_dong_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '吉林': {
            getGeoJson: function (callback) {
                require(['./geoJson/ji_lin_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '河北': {
            getGeoJson: function (callback) {
                require(['./geoJson/he_bei_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '湖北': {
            getGeoJson: function (callback) {
                require(['./geoJson/hu_bei_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '贵州': {
            getGeoJson: function (callback) {
                require(['./geoJson/gui_zhou_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '山东': {
            getGeoJson: function (callback) {
                require(['./geoJson/shan_dong_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '江西': {
            getGeoJson: function (callback) {
                require(['./geoJson/jiang_xi_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '河南': {
            getGeoJson: function (callback) {
                require(['./geoJson/he_nan_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '辽宁': {
            getGeoJson: function (callback) {
                require(['./geoJson/liao_ning_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '山西': {
            getGeoJson: function (callback) {
                require(['./geoJson/shan_xi_2_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '安徽': {
            getGeoJson: function (callback) {
                require(['./geoJson/an_hui_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '福建': {
            getGeoJson: function (callback) {
                require(['./geoJson/fu_jian_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '浙江': {
            getGeoJson: function (callback) {
                require(['./geoJson/zhe_jiang_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '江苏': {
            getGeoJson: function (callback) {
                require(['./geoJson/jiang_su_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '重庆': {
            getGeoJson: function (callback) {
                require(['./geoJson/chong_qing_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '宁夏': {
            getGeoJson: function (callback) {
                require(['./geoJson/ning_xia_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '海南': {
            getGeoJson: function (callback) {
                require(['./geoJson/hai_nan_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '台湾': {
            getGeoJson: function (callback) {
                require(['./geoJson/tai_wan_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '北京': {
            getGeoJson: function (callback) {
                require(['./geoJson/bei_jing_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '天津': {
            getGeoJson: function (callback) {
                require(['./geoJson/tian_jin_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '上海': {
            getGeoJson: function (callback) {
                require(['./geoJson/shang_hai_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '香港': {
            getGeoJson: function (callback) {
                require(['./geoJson/xiang_gang_geo'], function (md) {
                    callback(decode(md));
                });
            }
        },
        '澳门': {
            getGeoJson: function (callback) {
                require(['./geoJson/ao_men_geo'], function (md) {
                    callback(decode(md));
                });
            }
        }
    };
    return {
        decode: decode,
        params: mapParams
    };
});define('echarts/util/mapData/textFixed', [], function () {
    return {
        '广东': [
            0,
            -10
        ],
        '香港': [
            10,
            10
        ],
        '澳门': [
            -10,
            18
        ],
        '黑龙江': [
            0,
            20
        ],
        '天津': [
            5,
            5
        ],
        '深圳市': [
            -35,
            0
        ],
        '红河哈尼族彝族自治州': [
            0,
            20
        ],
        '楚雄彝族自治州': [
            -5,
            15
        ],
        '石河子市': [
            -5,
            5
        ],
        '五家渠市': [
            0,
            -10
        ],
        '昌吉回族自治州': [
            10,
            10
        ],
        '昌江黎族自治县': [
            0,
            20
        ],
        '陵水黎族自治县': [
            0,
            20
        ],
        '东方市': [
            0,
            20
        ],
        '渭南市': [
            0,
            20
        ]
    };
});define('echarts/util/mapData/geoCoord', [], function () {
    return {
        'Russia': [
            100,
            60
        ],
        'United States of America': [
            -99,
            38
        ]
    };
});define('echarts/util/projection/svg', [
    'require',
    'zrender/shape/Path'
], function (require) {
    var PathShape = require('zrender/shape/Path');
    function toFloat(str) {
        return parseFloat(str || 0);
    }
    function getBbox(root) {
        var svgNode = root.firstChild;
        while (!(svgNode.nodeName.toLowerCase() == 'svg' && svgNode.nodeType == 1)) {
            svgNode = svgNode.nextSibling;
        }
        var x = toFloat(svgNode.getAttribute('x'));
        var y = toFloat(svgNode.getAttribute('y'));
        var width = toFloat(svgNode.getAttribute('width'));
        var height = toFloat(svgNode.getAttribute('height'));
        return {
            left: x,
            top: y,
            width: width,
            height: height
        };
    }
    function geoJson2Path(root, transform) {
        var scale = [
            transform.scale.x,
            transform.scale.y
        ];
        var elList = [];
        function _getShape(root) {
            var tagName = root.tagName;
            if (shapeBuilders[tagName]) {
                var obj = shapeBuilders[tagName](root, scale);
                if (obj) {
                    obj.scale = scale;
                    obj.properties = { name: root.getAttribute('name') || '' };
                    obj.id = root.id;
                    extendCommonAttributes(obj, root);
                    elList.push(obj);
                }
            }
            var shapes = root.childNodes;
            for (var i = 0, len = shapes.length; i < len; i++) {
                _getShape(shapes[i]);
            }
        }
        _getShape(root);
        return elList;
    }
    function pos2geo(obj, p) {
        var point = p instanceof Array ? [
            p[0] * 1,
            p[1] * 1
        ] : [
            p.x * 1,
            p.y * 1
        ];
        return [
            point[0] / obj.scale.x,
            point[1] / obj.scale.y
        ];
    }
    function geo2pos(obj, p) {
        var point = p instanceof Array ? [
            p[0] * 1,
            p[1] * 1
        ] : [
            p.x * 1,
            p.y * 1
        ];
        return [
            point[0] * obj.scale.x,
            point[1] * obj.scale.y
        ];
    }
    function trim(str) {
        return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }
    function extendCommonAttributes(obj, xmlNode) {
        var color = xmlNode.getAttribute('fill');
        var strokeColor = xmlNode.getAttribute('stroke');
        var lineWidth = xmlNode.getAttribute('stroke-width');
        var opacity = xmlNode.getAttribute('opacity');
        if (color && color != 'none') {
            obj.color = color;
            if (strokeColor) {
                obj.brushType = 'both';
                obj.strokeColor = strokeColor;
            } else {
                obj.brushType = 'fill';
            }
        } else if (strokeColor && strokeColor != 'none') {
            obj.strokeColor = strokeColor;
            obj.brushType = 'stroke';
        }
        if (lineWidth && lineWidth != 'none') {
            obj.lineWidth = parseFloat(lineWidth);
        }
        if (opacity && opacity != 'none') {
            obj.opacity = parseFloat(opacity);
        }
    }
    function parsePoints(str) {
        var list = trim(str).replace(/,/g, ' ').split(/\s+/);
        var points = [];
        for (var i = 0; i < list.length;) {
            var x = parseFloat(list[i++]);
            var y = parseFloat(list[i++]);
            points.push([
                x,
                y
            ]);
        }
        return points;
    }
    var shapeBuilders = {
        path: function (xmlNode, scale) {
            var path = xmlNode.getAttribute('d');
            var rect = PathShape.prototype.getRect({ path: path });
            return {
                shapeType: 'path',
                path: path,
                cp: [
                    (rect.x + rect.width / 2) * scale[0],
                    (rect.y + rect.height / 2) * scale[1]
                ]
            };
        },
        rect: function (xmlNode, scale) {
            var x = toFloat(xmlNode.getAttribute('x'));
            var y = toFloat(xmlNode.getAttribute('y'));
            var width = toFloat(xmlNode.getAttribute('width'));
            var height = toFloat(xmlNode.getAttribute('height'));
            return {
                shapeType: 'rectangle',
                x: x,
                y: y,
                width: width,
                height: height,
                cp: [
                    (x + width / 2) * scale[0],
                    (y + height / 2) * scale[1]
                ]
            };
        },
        line: function (xmlNode, scale) {
            var x1 = toFloat(xmlNode.getAttribute('x1'));
            var y1 = toFloat(xmlNode.getAttribute('y1'));
            var x2 = toFloat(xmlNode.getAttribute('x2'));
            var y2 = toFloat(xmlNode.getAttribute('y2'));
            return {
                shapeType: 'line',
                xStart: x1,
                yStart: y1,
                xEnd: x2,
                yEnd: y2,
                cp: [
                    (x1 + x2) * 0.5 * scale[0],
                    (y1 + y2) * 0.5 * scale[1]
                ]
            };
        },
        circle: function (xmlNode, scale) {
            var cx = toFloat(xmlNode.getAttribute('cx'));
            var cy = toFloat(xmlNode.getAttribute('cy'));
            var r = toFloat(xmlNode.getAttribute('r'));
            return {
                shapeType: 'circle',
                x: cx,
                y: cy,
                r: r,
                cp: [
                    cx * scale[0],
                    cy * scale[1]
                ]
            };
        },
        ellipse: function (xmlNode, scale) {
            var cx = parseFloat(xmlNode.getAttribute('cx') || 0);
            var cy = parseFloat(xmlNode.getAttribute('cy') || 0);
            var rx = parseFloat(xmlNode.getAttribute('rx') || 0);
            var ry = parseFloat(xmlNode.getAttribute('ry') || 0);
            return {
                shapeType: 'ellipse',
                x: cx,
                y: cy,
                a: rx,
                b: ry,
                cp: [
                    cx * scale[0],
                    cy * scale[1]
                ]
            };
        },
        polygon: function (xmlNode, scale) {
            var points = xmlNode.getAttribute('points');
            var min = [
                Infinity,
                Infinity
            ];
            var max = [
                -Infinity,
                -Infinity
            ];
            if (points) {
                points = parsePoints(points);
                for (var i = 0; i < points.length; i++) {
                    var p = points[i];
                    min[0] = Math.min(p[0], min[0]);
                    min[1] = Math.min(p[1], min[1]);
                    max[0] = Math.max(p[0], max[0]);
                    max[1] = Math.max(p[1], max[1]);
                }
                return {
                    shapeType: 'polygon',
                    pointList: points,
                    cp: [
                        (min[0] + max[0]) / 2 * scale[0],
                        (min[1] + max[1]) / 2 * scale[0]
                    ]
                };
            }
        },
        polyline: function (xmlNode, scale) {
            var obj = shapeBuilders.polygon(xmlNode, scale);
            return obj;
        }
    };
    return {
        getBbox: getBbox,
        geoJson2Path: geoJson2Path,
        pos2geo: pos2geo,
        geo2pos: geo2pos
    };
});define('echarts/util/projection/normal', [], function () {
    function getBbox(json, specialArea) {
        specialArea = specialArea || {};
        if (!json.srcSize) {
            parseSrcSize(json, specialArea);
        }
        return json.srcSize;
    }
    function parseSrcSize(json, specialArea) {
        specialArea = specialArea || {};
        convertorParse.xmin = 360;
        convertorParse.xmax = -360;
        convertorParse.ymin = 180;
        convertorParse.ymax = -180;
        var shapes = json.features;
        var geometries;
        var shape;
        for (var i = 0, len = shapes.length; i < len; i++) {
            shape = shapes[i];
            if (shape.properties.name && specialArea[shape.properties.name]) {
                continue;
            }
            switch (shape.type) {
            case 'Feature':
                convertorParse[shape.geometry.type](shape.geometry.coordinates);
                break;
            case 'GeometryCollection':
                geometries = shape.geometries;
                for (var j = 0, len2 = geometries.length; j < len2; j++) {
                    convertorParse[geometries[j].type](geometries[j].coordinates);
                }
                break;
            }
        }
        json.srcSize = {
            left: convertorParse.xmin.toFixed(4) * 1,
            top: convertorParse.ymin.toFixed(4) * 1,
            width: (convertorParse.xmax - convertorParse.xmin).toFixed(4) * 1,
            height: (convertorParse.ymax - convertorParse.ymin).toFixed(4) * 1
        };
        return json;
    }
    var convertor = {
        formatPoint: function (p) {
            return [
                (p[0] < -168.5 && p[1] > 63.8 ? p[0] + 360 : p[0]) + 168.5,
                90 - p[1]
            ];
        },
        makePoint: function (p) {
            var self = this;
            var point = self.formatPoint(p);
            if (self._bbox.xmin > p[0]) {
                self._bbox.xmin = p[0];
            }
            if (self._bbox.xmax < p[0]) {
                self._bbox.xmax = p[0];
            }
            if (self._bbox.ymin > p[1]) {
                self._bbox.ymin = p[1];
            }
            if (self._bbox.ymax < p[1]) {
                self._bbox.ymax = p[1];
            }
            var x = (point[0] - convertor.offset.x) * convertor.scale.x + convertor.offset.left;
            var y = (point[1] - convertor.offset.y) * convertor.scale.y + convertor.offset.top;
            return [
                x,
                y
            ];
        },
        Point: function (coordinates) {
            coordinates = this.makePoint(coordinates);
            return coordinates.join(',');
        },
        LineString: function (coordinates) {
            var str = '';
            var point;
            for (var i = 0, len = coordinates.length; i < len; i++) {
                point = convertor.makePoint(coordinates[i]);
                if (i === 0) {
                    str = 'M' + point.join(',');
                } else {
                    str = str + 'L' + point.join(',');
                }
            }
            return str;
        },
        Polygon: function (coordinates) {
            var str = '';
            for (var i = 0, len = coordinates.length; i < len; i++) {
                str = str + convertor.LineString(coordinates[i]) + 'z';
            }
            return str;
        },
        MultiPoint: function (coordinates) {
            var arr = [];
            for (var i = 0, len = coordinates.length; i < len; i++) {
                arr.push(convertor.Point(coordinates[i]));
            }
            return arr;
        },
        MultiLineString: function (coordinates) {
            var str = '';
            for (var i = 0, len = coordinates.length; i < len; i++) {
                str += convertor.LineString(coordinates[i]);
            }
            return str;
        },
        MultiPolygon: function (coordinates) {
            var str = '';
            for (var i = 0, len = coordinates.length; i < len; i++) {
                str += convertor.Polygon(coordinates[i]);
            }
            return str;
        }
    };
    var convertorParse = {
        formatPoint: convertor.formatPoint,
        makePoint: function (p) {
            var self = this;
            var point = self.formatPoint(p);
            var x = point[0];
            var y = point[1];
            if (self.xmin > x) {
                self.xmin = x;
            }
            if (self.xmax < x) {
                self.xmax = x;
            }
            if (self.ymin > y) {
                self.ymin = y;
            }
            if (self.ymax < y) {
                self.ymax = y;
            }
        },
        Point: function (coordinates) {
            this.makePoint(coordinates);
        },
        LineString: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.makePoint(coordinates[i]);
            }
        },
        Polygon: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.LineString(coordinates[i]);
            }
        },
        MultiPoint: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.Point(coordinates[i]);
            }
        },
        MultiLineString: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.LineString(coordinates[i]);
            }
        },
        MultiPolygon: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.Polygon(coordinates[i]);
            }
        }
    };
    function geoJson2Path(json, transform, specialArea) {
        specialArea = specialArea || {};
        convertor.scale = null;
        convertor.offset = null;
        if (!json.srcSize) {
            parseSrcSize(json, specialArea);
        }
        transform.offset = {
            x: json.srcSize.left,
            y: json.srcSize.top,
            left: transform.OffsetLeft || 0,
            top: transform.OffsetTop || 0
        };
        convertor.scale = transform.scale;
        convertor.offset = transform.offset;
        var shapes = json.features;
        var geometries;
        var pathArray = [];
        var val;
        var shape;
        for (var i = 0, len = shapes.length; i < len; i++) {
            shape = shapes[i];
            if (shape.properties.name && specialArea[shape.properties.name]) {
                continue;
            }
            if (shape.type == 'Feature') {
                pushApath(shape.geometry, shape);
            } else if (shape.type == 'GeometryCollection') {
                geometries = shape.geometries;
                for (var j = 0, len2 = geometries.length; j < len2; j++) {
                    val = geometries[j];
                    pushApath(val, val);
                }
            }
        }
        var shapeType;
        var shapeCoordinates;
        var str;
        function pushApath(gm, shape) {
            shapeType = gm.type;
            shapeCoordinates = gm.coordinates;
            convertor._bbox = {
                xmin: 360,
                xmax: -360,
                ymin: 180,
                ymax: -180
            };
            str = convertor[shapeType](shapeCoordinates);
            pathArray.push({
                path: str,
                cp: shape.properties.cp ? convertor.makePoint(shape.properties.cp) : convertor.makePoint([
                    (convertor._bbox.xmin + convertor._bbox.xmax) / 2,
                    (convertor._bbox.ymin + convertor._bbox.ymax) / 2
                ]),
                properties: shape.properties,
                id: shape.id
            });
        }
        return pathArray;
    }
    function pos2geo(obj, p) {
        var x;
        var y;
        if (p instanceof Array) {
            x = p[0] * 1;
            y = p[1] * 1;
        } else {
            x = p.x * 1;
            y = p.y * 1;
        }
        x = x / obj.scale.x + obj.offset.x - 168.5;
        x = x > 180 ? x - 360 : x;
        y = 90 - (y / obj.scale.y + obj.offset.y);
        return [
            x,
            y
        ];
    }
    function geo2pos(obj, p) {
        convertor.offset = obj.offset;
        convertor.scale = obj.scale;
        return p instanceof Array ? convertor.makePoint([
            p[0] * 1,
            p[1] * 1
        ]) : convertor.makePoint([
            p.x * 1,
            p.y * 1
        ]);
    }
    return {
        getBbox: getBbox,
        geoJson2Path: geoJson2Path,
        pos2geo: pos2geo,
        geo2pos: geo2pos
    };
});define('echarts/util/shape/HandlePolygon', [
    'require',
    'zrender/shape/Base',
    'zrender/shape/Polygon',
    'zrender/tool/util'
], function (require) {
    var Base = require('zrender/shape/Base');
    var PolygonShape = require('zrender/shape/Polygon');
    var zrUtil = require('zrender/tool/util');
    function HandlePolygon(options) {
        Base.call(this, options);
    }
    HandlePolygon.prototype = {
        type: 'handle-polygon',
        buildPath: function (ctx, style) {
            PolygonShape.prototype.buildPath(ctx, style);
        },
        isCover: function (x, y) {
            var originPos = this.transformCoordToLocal(x, y);
            x = originPos[0];
            y = originPos[1];
            var rect = this.style.rect;
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                return true;
            } else {
                return false;
            }
        }
    };
    zrUtil.inherits(HandlePolygon, Base);
    return HandlePolygon;
});define('echarts/util/mapData/geoJson/an_hui_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3415',
                'properties': {
                    'name': '六安市',
                    'cp': [
                        116.3123,
                        31.8329
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nJUXUV°UÑnU@mlLVaVln@@bn@VU@xlb@lLnKlVIJUVxnI@lVL@b°VX@bxnVVUnVVnU@kX@VwV@al¥UUnUWa@@wĸULU¥lKUa@aUI@alLVaU¯anWkUKm@XV@VaXlW@aU_UWVUI¯@ma¯W¯I@UU@WWU@U@@UU@VkV@@WUUm@UaU@lK@IUKL@KWmXUWaXI@@a@a@U@U@KV¥lwk°b²JVIVKlV@UXlaUl`UVLVVVUJU@Lnm@_VK@KUIW@J@Xk@WW@UmmXmWk@kK@aUUVmmkUwUmWL@WmU@UJmUULkKWakLWVkIlwULW@X°lUJ@°ULWVwmJ@bmb¯Vkm@@WkWm¯wL@lkXWmXym¯UImJUbkV@Vn¯@V@lUb@mk@maUxmlUbULWn@JLmKUkWKkwUKbmXWxkVUKmLkVV@JUUWL@xkJUUV@X@VVlUbVX@xk¤x¼xWxnnn@Þ¼JVb°aVn@mlnXUJlbVlkz@lUlXJmxVxXnWxXÈWlU@UxU@VX@xUL@UÆmLnV@lWXk@@JlbXblnlJ'],
                    'encodeOffsets': [[
                            118710,
                            33351
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3408',
                'properties': {
                    'name': '安庆市',
                    'cp': [
                        116.7517,
                        30.5255
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n°znWXlW@kK°xXnl@Xn@l°Una@anIxXUVK@¯VIkW¯X@VKxklJXUlKXblLVKnVVIV@Xn@XKVnVxlnnUlmV@²óUkVlWbln@VVVIn@lw@WVIXblV@ÈxaUaVIVVnKVLKln@b²K@»U£ÑķġÝÅbKa@Im@Û@kWÓkkmKÅnóJUÅ£W@wĕ@wĉţ¯¯UkK±l¯U¥UÑkÝUķ»Ý¥¯JIUVbUl¯ÈV¼VJU¼Vb@bkLUl@VJ@bUXÇ@lkVmXmKkLVxVL@VkVVVlzWkbmLUUUbVbUVlÒnJlUnLllUL@bUVxlLXVÆ¦ÈVU¦WJ'],
                    'encodeOffsets': [[
                            118834,
                            31759
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3411',
                'properties': {
                    'name': '滁州市',
                    'cp': [
                        118.1909,
                        32.536
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@`nnl@xK@X°KXVIXVlbXVWnXlL@È»LVan@VJêVVn@X@laÞbVayn@_xnWVXnWl@VnUVkI@lnXKVLVV@V@kW@LlVô@J@bVnnKnkVa@»lç@nwKmaUUUVÑ@nmWXalI@alVn@VwUaVU@nlaôJnUVVXlJaXXVK@UV@VWx@nXVWXVUlLUbVULVVnUVbUbVb@@aKÆnnKVK@U@UU@@a@V°¯ÈJVIlķ@aaUaVKU_@mkxUI@aUlyU@@wkKWmUbUnUVWbkJW_J@bn@Vm@@KULk@V@@bVbÅm@LW@UVVbkK@UkKWL@VULUKWIUJUbkK@_WVXUJka@XVa@ky@aVIUUW@@mUlLKWÑUKVan@UkVmmIXKaVaUwVU@UmykU¯@±UUL@WUIVUU@KkIWaaU@kUUaÇUó»mKk¯@y@kWK@bkI¯`mnl¯XWlkVUzUJlbUbVJl@nnm@VULV`XnWÆbmUUnJmUknJ¯km@yk@kUxL@VUbmnn¤lX@`z@JmaULUVl@Xn@xllkXWaaW@UVmUb@mVXWxXbWbUÒnVVnVVUL'],
                    'encodeOffsets': [[
                            120004,
                            33520
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3418',
                'properties': {
                    'name': '宣城市',
                    'cp': [
                        118.8062,
                        30.6244
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vb@XLJXxlIXxlVlV@I²¤nlUnVU@VULWVUJ@Lnb@lV@UnV@@VVVlLnbnJUVkUUVWn@@anUVnVJVIV@@nUJVbUb@VUbVK@bn@VbnIlxkllXVlXKWUXUlL°¤UVVb@bUlkXWxXz@IlaUlnUlJVInVÆJULVUnVK°@VnlVnxV@XLlK@wVL@KnUlJXUbnKVLXlUw@VWlLXKm@@a@VLnmlIVVnKn@kVaVlwk@@a@k@VIUa@maUa@wna@kmWUUmVUIVÇ@aKmakUJ@InmUUaVaklX@Vk@m@VU@wnK@alKVUkUkKbmUkm@U£WVk@@UÝbbaÇx@b@WVUa¯@wVwUUV@VwnK@KWaÅ@KIUyUI@WmXóUbWaKm@km@IUyIUaWKx@zUKUL@llVUnkLVVkJWX@VUKUVIkVWakb@VWb@n@JkXUlmL@xkL@`VxLUÈUJ@Vm@@bmIUlUL@VUVVbknm@mKUwKVÈ@J@LV±kkJUIl'],
                    'encodeOffsets': [[
                            120803,
                            31247
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3412',
                'properties': {
                    'name': '阜阳市',
                    'cp': [
                        115.7629,
                        32.9919
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vn@ak°a±@¥@UUI@aUmlwUUxb@¥XU@mmI@a@Kn@@_W@@WI@mUVVXUl@XaV@K@I@aLX@aVI°K@KVLUUwyXkK@kKÆbXnlK@k@aJlU@w@U@»@aXKWn_JXkVKn@°LlKXW@¯U@aUK@kmJUwVIUJkmLK@kka@wUVm@@am@UkUbkK@nmVÒ¯VUWVVmIULk@ma@kkK@nUbUamU`UUVUkKVkkW@@bkmnmUXVKXVL@VbUmbVXJ@nmKÅI@KWKUXVJUL@VUKUX@KUKWL@LUJmaXXm@kVVV@L@VUL@VlK@L@V@LUK@VUb@UUU@°@nVxU`Lkn@`@XVJ@XVmk@UKmV¯LVVn±Wm@Ub@JlLUl@VLk@lmVVn@bnV@V°IVaVJXI°K°V@XXVlVVUnKVlUbWXnV@bV`U@@m@@@nxmn@bXVlL@¤nbUl¦VVUnJVUVl@@bÞL'],
                    'encodeOffsets': [[
                            118418,
                            34392
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3413',
                'properties': {
                    'name': '宿州市',
                    'cp': [
                        117.5208,
                        33.6841
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@UWU@bkW@aWU@aUIkWVlLXblVIUVV@mn@V_n@VaUK@I@UaanJVU@lVUVnnKVVlaUaI@wnKLnll@nVlk@wVKXkl@@bbUJ@VU@UUUyVk@aVUXwlWXXWU¹@aU@WUI@mlUnJ@Il@aXbV@VKl@XxVL@WIJlb@al@IUUm@@aVK@¥¯@mUķ¯bWk£Vm@akm@VaÅ@UVWa@UJWkJUbWbU@UlXk@amV@K¯nk@lU@Uxmz@bU`ÇbUbÅVm£U@Wwx@akLUK@UlakwUJWVkLmaUal@n_mVUnKVUUmÅXWa@kJmx@XUJ@bVLXxl@VVUVVUbkLWbU@@lUVVVVXK@XkJ@nU@@bV@VxUVlbU@xXLWn@UxVbVĊV@b@XV`mnkJ@kUKmbaU@VbnbÆx@XU@@`k@@bl@@bkL@WakXWaU@Vmkx@XWW@@wUUUbJU¯V@¯ÞU@WxXlL@bkb@lVlnbJW@kkU@mbkaWJIVlmz¯`UnU@mb@@`@bkVlnV@b@V@aVxn@VxKXnl@nbVKbVK@a_V@Vw@WLlwnK@UmIU@VW@UÈ@lKnalw@@V°@aUmlUUw@V@@UXK'],
                    'encodeOffsets': [[
                            119836,
                            35061
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3410',
                'properties': {
                    'name': '黄山市',
                    'cp': [
                        118.0481,
                        29.9542
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lXnlWX@VUJVnUJVzXJVxkVJlI²lU@K@IUÇLVxnLn@lmUaVU@UVKVknJ@an@@UVIVÇKUw@_lK@wnKVklW@I@mXa@UlaXblUJVUVL@UXWlIUUlKVmkU@kVKVL@ywXLVbJVz@Jln@nLXbVaônW@la@UVWUa@@a@mk@WIk@VwUa¯¥m@UUVK@ImK@aX£kKÅVa_@±akXWWLnU@@a@¯mK@LJUWwUVVmbXX@lWLn`mzUJUbLk@makVWmkXambkKkna@ab@U@Unm@WV@VbUbUJWIk@@lmL@°UVUVmn@@kmWkb@x_m@@aU@b@JlUzlWxXn@b²@l`IVlUlL@VKnVbUl@VlIn@@bbVWUk@@bX@Valb@bnb°Vn@xVKlbVnV@VxL@ln@UXVVL'],
                    'encodeOffsets': [[
                            120747,
                            31095
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3414',
                'properties': {
                    'name': '巢湖市',
                    'cp': [
                        117.7734,
                        31.4978
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VV@blL@XlWnnn@VXXl@@WIX@VJ@LxŎxln@bXJVblX@VVbUVn@VbUVlb@LnJVbVLVXLÒVLÒVbVIVylUXk°Wknm°_lJ@aXL@lz°@lnLô¼VÈVUUaVKU@WW@@UUa@knmVLlaV@a@kak±@UmwkKmkǉÝUUkL@mlIVmnÝWkkUÝ@KƑĉa@»mma@mX¤¯Uw@@UU@bU±±L@akmLUKmLUUUJVbbÇw@kUWaUJ@Xkxm@UJUUm@kakXUVl±ôU@kn'],
                    'encodeOffsets': [[
                            119847,
                            32007
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3416',
                'properties': {
                    'name': '亳州市',
                    'cp': [
                        116.1914,
                        33.4698
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lU@Un@@anUlw@KVmUwlaX_lKna@KU@@kWKUU@ankWXK@@V²VVIÈU@al@VaÈamK@wU@klaUV@XVUU»WUUbkmUkVmk@aÈw@mWU@VkIkVWKUÑķXȭºU¯l@kkLWmÅaL@lLWlzVxVUK@L¯LUJ@bWK@b@JLU@Wbk@WVUUV@nJ@XX@@`m@@L@bnJ@nWV@¦awVVkxVn@bVJ@V¦@²¯blb@mUU@¼¦XbUV`@nnxUxWLkUkVWKkV@XV@@VVL@VX@lVV@L@blL@`L@xXKVL@VnU@lwnU@ml@XnV@@UVW°LnalUI@aUK@aa@UkXW@I@mWL@UXK@UVW@U@@kWn@@V@XblaVxL@bVKXbIlJ'],
                    'encodeOffsets': [[
                            119183,
                            34594
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3417',
                'properties': {
                    'name': '池州市',
                    'cp': [
                        117.3889,
                        30.2014
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@V°°ĊŤ@xĖ@xXÆ¤VôIÆmnLllXÔ@lÜn@@JbLÆaĢÞĸ°VVUUKVanK@UV@VLVVnln@xnklxXamk@WV@Xa@naVkKlk@mkUWwkJWwIWK@UaUwWIUyVIUmVI@UXWmkkWKUUVWm@@kKw@UUUmkaULwm@¯Uma@akaUbW@@a@VlUXa@am@kJ@UVkUamL@UkKVUkJk_±@a@WmXwÇkkaVaUa±wV@VkwnyUaW@UU¯amLk@m@kmmU¯K@L@lUX¯WlkXVbbVUL@J@LVKnlJXnlb@`nXlalV@bnL@Vnb¼@lXbWlkLK@zUJmIUxUVUVmX',
                        '@@llUL@VlxL@a@UwXa¯@'
                    ],
                    'encodeOffsets': [
                        [
                            119543,
                            30781
                        ],
                        [
                            120061,
                            31152
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '3401',
                'properties': {
                    'name': '合肥市',
                    'cp': [
                        117.29,
                        32.0581
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@LxVĊLÞkVlVVXaWaXwWnU@anVVUX@bXblWkk@wWmk@VUVKnb@Iy@_kWm£nmVa@UKwlVl@zn@°lIlmnVIVmnVaXÅWmU_VK@Unmmk@UIVakaaUÑUKÑWKUUKUamI@KkaVUUam@VUUa@UkWUaWI@akmōwwUL@`mn@KVIUVUUUKVk_VkbW@VkUULUJ±I¯alkxU¦@L@V@V@b@b@WJXbWVXn@LKVL@JkLV@Vbn@VV@XU@UlV@@VV@V@XXV@@VJ°°Xnb°@JUVVXV`@bkXWUbU@Wn@VLXlm°bVUbkK@bVJ@bVbkLV¦KķV@x@XbmVVVk¦'],
                    'encodeOffsets': [[
                            119678,
                            33323
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3403',
                'properties': {
                    'name': '蚌埠市',
                    'cp': [
                        117.4109,
                        33.1073
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VÒXLlUlJ@UXV@nÇx@bnlUVllnVaXVV¼UVWU@V²wVV@Vl@VnwlI@XbÆWVnUVmLUVnm`k@VbnblKXUVIlxkb@VVLlK@bwXxV@n¤ÆUVaÈaV_@anyVwV@kl@°m@LnUbl@WVkV@XaaVIXlIV@XbVUÆ@XKWwUkmW@_UmnIlJXkWKXmV@w@_XV@Kl@kU@KlX@@UUUUKWLm@klJVUUmk@mXUWmXw`m@zUbÝakbW@m@UUéUIm@UbKÇ¼@kKWXmWUkaWUJWU¯L@WLwk@mm@_ÅlUVkmWUnV@VWLUbbƑĬ¯l'],
                    'encodeOffsets': [[
                            119543,
                            33722
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3402',
                'properties': {
                    'name': '芜湖市',
                    'cp': [
                        118.3557,
                        31.0858
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bVaV@XllLXU°lL@V@VUnVl¯IkVUVU@@b@lUXUWmbn@¼bƒĊLÞ@lVXlmÞUnkJ@nlKVVÞXklWVaVI@aUKn»lL@Kn@XXwlm@mn°@V@WywXlWVk@aUaVU¯£kKWVXVWLUkkWlkkwmJUam@@aULVa@UVaUaVI@m@UUJUIUmmV@bm@UXVVUlVmImakKUU@UU@VmU@@kma@KVIXUVK@UVmUkVm±£@JkU@nlkLUlmb@WbU@@XnlWb'],
                    'encodeOffsets': [[
                            120814,
                            31585
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3406',
                'properties': {
                    'name': '淮北市',
                    'cp': [
                        116.6968,
                        33.6896
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@lnnK@¦n@@VV@@VV@nIVV@VW²a@b@bVnUVVV@Vz@l@°UVIVaVV@x@XX@WlwUnV@XblWb@XlK@a@k@al@@_V@@WÅwmaUaV@bnaVL@llInmU_@W@aUUĉUaVwm@XWK@wVkaVUUwU@@aV@@mlI@WLWUUUVU@kV@XalKVaUVUUUk@WwUK@aVI@WUk@@UUU±xkb@lV@xnLÇbUbk@@bÇVUJ±U@U@WLXml@bVVXL@lV@@LmbkLW`kbVxUn@LkxmV@bm@@VkV'],
                        ['@@VVVkV@¥@UV@U@VUUJkWakKUlXVJ@bXV@blX@aXV@V']
                    ],
                    'encodeOffsets': [
                        [[
                                119183,
                                34594
                            ]],
                        [[
                                119836,
                                35061
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '3404',
                'properties': {
                    'name': '淮南市',
                    'cp': [
                        116.7847,
                        32.7722
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°kƒīaVaXK@UUVmnXUlVÆkVKUUUmmUÑkUUÝlĉKUwKbU@UxW@@lmVUUVmUUmwaWkL¯K@mULWlIm`XWL@b@¼@V@xkVI@b@l@lkV°Ȯ¹ĸW'],
                    'encodeOffsets': [[
                            119543,
                            33722
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3405',
                'properties': {
                    'name': '马鞍山市',
                    'cp': [
                        118.6304,
                        31.5363
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǊnllLnxV@laXLVKmaaXbVIbVKVVVIVyn@n_W@@UnJlUVVXlLnaUWlV@VVIXW@_W@XK@K@UVUUwVamÑXmmwwKUnUKçU@JU¯@m@nknWxWm@@LkKm¼VL@bUJUbkXWl'],
                    'encodeOffsets': [[
                            121219,
                            32288
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3407',
                'properties': {
                    'name': '铜陵市',
                    'cp': [
                        117.9382,
                        30.9375
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ÒV¤@¼V²@aVV@@x°V£nW@nbnaVXVW@k@aV@VUUl°JUkVm@U@UkK¯WVkKWkU@Ubakwmlwm@kUmUUKU@@VmLUbVLUV¯U'],
                        ['@@LllUL@VlxL@a@UwXamK']
                    ],
                    'encodeOffsets': [
                        [[
                                120522,
                                31529
                            ]],
                        [[
                                120094,
                                31146
                            ]]
                    ]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/ao_men_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [{
                'type': 'Feature',
                'id': '8200',
                'properties': {
                    'name': '澳门',
                    'cp': [
                        113.5715,
                        22.1583
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@HQFMDIDGBI@E@EEKEGCEIGGEKEMGSEU@CBEDAJAP@F@LBT@JCHMPOdADCFADAB@LFLDFFP@DAB@@AF@D@B@@FBD@FADHBBHAD@FAJ@JEDCJI`gFIJW'],
                    'encodeOffsets': [[
                            116325,
                            22699
                        ]]
                }
            }],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/bei_jing_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '110228',
                'properties': {
                    'name': '密云县',
                    'cp': [
                        117.0923,
                        40.5121
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@vIHZDZQtDLNMXIbHRCXXITbJ@H`LGPRDDJNCLHTOCWFGvGBUJMKGFO^IHWXITQCIY^AXGfRDXF`DJOLB~G\\DZIHHpErUVMhHb]\\MBVF@FTP`@zTbD\\@~M\\K`H^EVODWICAakAQXoIcCOCIgGYNWFWNGGKKGaJEGMEIKYJUT_J_Go@_SyQaSFMEGTcYOQLIIi@EKAUPCV[EEXQCW|aMUMAaYCYNIDGGACIMGGSKDQGaF_C[GaB@GOIiOKAYLmI@CN]F[SWWAcKKI@HMUimEKbeYQYISNUOcBKPIFBNgvDPGZYFSf]CMSIWGEUFgDIQ[MeDMJS@RR@LphFPCHaBAJKF@J]IBJO@HlO@@RKAMPJHCNDJTHFP@ZGNANBRFH@J_fM^ONJNF\\VTDJHDON@XRND\\XRCPVETCLBVKDFJINHRGPRV@\\CLJN@VbXbLVT'],
                    'encodeOffsets': [[
                            119561,
                            41684
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110116',
                'properties': {
                    'name': '怀柔区',
                    'cp': [
                        116.6377,
                        40.6219
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@JHTVHXCHPfnDJGHNDJSB[JSBGVSAOH@PMPuDEHHXZN@PHF@ZLJ@LHVYJA\\OFWP]BMtMBSRGV[JeVAPQVIFENMD¡@^NV\\JH@NNL@NM\\kTQ\\I^FNIpBHGTBFFAZQfKDIXQTLXFXNNVMVHRGpCFLlRLEVBBH`IVO\\G`RDPAXLXBXORHZEHTDLLN@VGTMrQNFPeASKG@GMOAKBYMK@GTUHUXSHMVDNMOUEOZMJML@^KRACMZEZMRQLUHE@OFENPR@DI\\ChMHIDG\\GJMDWHCKGMDCIQCHO_K@GaIJSWWQDaGWJMNCKRsCYGYuJUSaKaW@UIMDK@[QUHOGQJMEILCAUDKFSOUQD[WMCQ@WPMGCCIUSE[IMPMN]`e@IEGAQBMHM@YEOSGCIDMIGNOLB@QP@GkP@AI^J@ILEBIbADGEOog@KQQWSekWQQUOFKZLF@PUNmIaHIUeBCTSHENcJa@_IWSaGu`GLSBKJQFOXGDXVQVOBIHcDSJWBEFGTMH[^mLaXcHiKElTRKtFXZ`MHMPCNRDxZB\\ICIHK@KHbIVFZ@BPnGTGbDXRDJaZKRiGEFSFEJhjFNZFjn'],
                    'encodeOffsets': [[
                            119314,
                            41552
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110111',
                'properties': {
                    'name': '房山区',
                    'cp': [
                        115.8453,
                        39.7163
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@h@bl@HRJDZ``TA\\VVD^H`\\pF\\J`JGv@ZO\\GPSTEjPTR`FnEbDTDHEhLFMTK@ETSPULKEI@OVISKSJACEQNQbVIXGDIN@dMB[IIBcN]ZHNLP@XOWCFWCNRHTpATD@^NVNLED@Rh@jCEF}E[OOHUEW]W@QGGDIQSH_MmFmCUT_K]i@MHCMWFCFE{BMHMPOHKS]CFNGBELDH_@BcAKOACESAOBELaXAROB@FODMEDWJAG[aE@UM@DImEWJMC@OeCA{aE[@{L@MINUCQXKfUJORCHqJBF@TCXWNQX]M[EAJO@@KMBQJIC]EWMCCUBEBFHKDOTMBGNGF]MWDBRDdMDQVyE@LPVHDCP@JVVMTG~HNSH[CmRUvHPHBbA\\PTNRC\\YNJPRARPJDDR'],
                    'encodeOffsets': [[
                            118343,
                            40770
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110229',
                'properties': {
                    'name': '延庆县',
                    'cp': [
                        116.1543,
                        40.5286
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@^AXOPEB[ZIGU@KKI@YGE@OYMGWFGvCNO@OPGTBHUTA\\ITACIGMIHmCOeDGGWSUIGimYEEMgiFITEFEjHLQbYCIWQaCSHmHAOY@UEaJG@LGLDJ[JAwYQCDMNONGY_EWLsSQFkMO[NWAIGaIYL@HMBOKiOQDWEUDMQSF_QIUBWdg@[NaAKQ@M]OQ@WhgLUMMFYQDIRCEUZOOCIOJ[KIUMKL@HIDKVEBM`HJAJSJUdBLGNEdMBMO[BYEWJSNKNaD]PE\\SjOT_RQVEZPpNQXfNA~lNG`@PNLp¼RFLfbdKbATUh@FSNWjGFZVLFHVA~X¨PPROfFJbNJPLFbENJPrEFNPFRHDDJdENJLVEPBJTVTHGHFRFH@PXP\\ORQHW\\BjWFDERLPPBbB\\E`B\\D\\L`@F]FCnJ^AZL'],
                    'encodeOffsets': [[
                            119262,
                            41751
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110109',
                'properties': {
                    'name': '门头沟区',
                    'cp': [
                        115.8,
                        39.9957
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@V@XMnGPY²JQNEhH\\AZMPDVTTDZCPiJkHSHCjIdFtEHITCNITQEKUAMCEIKCECABYESKFWAKBEIIHABGDCKCAIHMHALKEI\\CFIBILIJQZS]BBEECS@E@@C]COKI@CABAAEEDMGCH]A[M@CJWHJaUMRFRBDTITLUJ@PFJKLOVST@FSLENgKGFSCaCmF_ESQiOSFOT[HYPu@IH_[IoE_[]GUC[USB__CYQI@Gakg@qZeHQNMNV\\FVLPgJAFJPRLCH[XcPELUT[JiV_EELFTADBXRTRLJC@fHXHHbPd`fR@NfT`@TLplHMpCEJHJBVLF@JTVnG^KXDXHNVGRLRXFJVdDHSNWLGfEzA'],
                    'encodeOffsets': [[
                            118635,
                            41113
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110114',
                'properties': {
                    'name': '昌平区',
                    'cp': [
                        116.1777,
                        40.2134
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VNLJI\\JPPDYPFVQDCJZRNEVNhKXgR@^P@NLRbB\\Mh@XcVARJE`RTCNFVXRCjPPLNA@GZKbJJHXB\\MNPjLdGbWnK\\]NGHSFEXATIdCJGPARUWUHCPWRELITAHKv_E@iYCaW_BQ\\Y@QIO@QDCIGZCEMWGFMFAFgHEDOCSqKCCFGAMKEAC@ODGCGs@WH@KQA@EE@CE@GEA@EH@GGUEEJEAYD@JM@@DAA@FHD@FTJEHUC@JUBKCKG@G[CIIQReAYhO@OXGDO@@FF@IHJFCPEBACBIAAKDOABXARHPNEHGbQAAKQFGIAM[C@WHKaGiCEGOAHUKCIokSCUSOCYN[BgGMFIR±OZmHWNU@ShbbXDHVXXGJ^lZ@PZ\\Nb@\\FHJAD'],
                    'encodeOffsets': [[
                            118750,
                            41232
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110115',
                'properties': {
                    'name': '大兴区',
                    'cp': [
                        116.4716,
                        39.6352
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@F\\E~DFN@BDFEpHFCHBBEGCDCJBHUDSBB@ELCPbF@B\\J@BJVAFJ\\ADKTCBGECFMT@BMN@@FH@DaNBEnvB@FPBATK@FHEFIAKFBFL@@PKBFJHC@FXBRAFCDMPDTOL@JIVFDHH@DDH@BGRFCDLD@N^@@CNA@KNOAEBCECFEGCFGMGFIPMOEJOLBADBBHGG@GCHIECY@INC@DMGS\\AIOZAAEYA@GT@KKMBEETCGMVINFxA@MJADB@FlA@HJA@NND@DFA@DVAZBBOFKH_JA@K^GBC@EFEG@gAENMXKJigC@IbSJMqGOP£RGSMGE@kbQFDPEFiBSGGSBK]I{CDWCIDOic[C_G@SuSO@EWKCO@MNY@\\uZOPENQD[LKESSKGBKEG@EJGAGHoH¥CqhifeJkX_XFFGHFNEDFPENKHM^IFIVL^S`DVEnNnG`RTCJHH@R^XFXGVPP'],
                    'encodeOffsets': [[
                            119042,
                            40704
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110113',
                'properties': {
                    'name': '顺义区',
                    'cp': [
                        116.7242,
                        40.1619
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@EhEBENXHFNYDJHCD@RJP@R[ZARX`DbjZF@bHXT`Jb@dIFMTGDSfAJVbGnJVM@OKELYPERVXRflXTT@NIfC\\NJRhCVEHFJXNT^DTeZEHYCOhuAMJELOdAVPTMOWBWNMNEJgl]@WGUFIC[T{EEDEHGCIGMI@SECUQI[D{A{GQESPUH]CsiMCmHUeoHENcAaDGCMDGMQCACCBaCGLMAHB@DIEQLOAAEEJ@CW@CDINGAAGKQOCgV@LG@BEGDKNeREFBNCFIDOPKD[@YRW@GFWDAFE@EHDDrLDTCPGF',
                        '@@KrJEH[\\B@FF@CHFBHUNAJKADGECBCMAG^E@EbI@BEGP'
                    ],
                    'encodeOffsets': [
                        [
                            119283,
                            41084
                        ],
                        [
                            119377,
                            41046
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '110117',
                'properties': {
                    'name': '平谷区',
                    'cp': [
                        117.1706,
                        40.2052
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ZJZRafFLjnVGNJ@LLBdXX\\T^EDMJ@nZKLBjPPJ@HbA\\H`DbERHLCFK^BZaFWXQLAGMHa\\OLO@SBIpBdCLVQfElO@GSAKEDQTC@GEBKG@ORIJBDAPDFA@CaOq@GGQAAEJK@KMUGAAGEAa@MGMBGCGSIIW@WSUCMDOJeWOM@IUF{WMWaDIMgIoRoCOKeEOEAG_I[cg@wLIFENQFDVTFJ@HNDJGHCFFFS|D\\EJHV@Xk^IhMFMNAXPX'],
                    'encodeOffsets': [[
                            119748,
                            41190
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110112',
                'properties': {
                    'name': '通州区',
                    'cp': [
                        116.7297,
                        39.8131
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@FDAJTGDNDCTDDEDBBE@DT@@EHCDGJ@EIZ@@FDBR@ATFBBVFFE@@HNA\\VE@CLIFNJFNJBCP]A@LJFA@HJEDD\\C@DBCHLAEPF@@DH@APHAERDF\\GIxDTM@CFLBBFJ@CNUPMHECGDBF]BMFPDLRBHHBJMDCX@@DFIBFPBRKJF@CGANBHKbDDABDRDHNNCHDbCdBFMpGHiOYMefKJMC}HWAUNW\\NNBNAkNU|]HMTMN@MZBLFFF@RIRUTBMFIEGaAGGAOIIUGTSFcYKS@MSLYPKRUBU]EWDOI]CKGASgW@MTWKIMCS@uMAKKADMECGAKVUTSDy@IjWLMNBF@hHEF@FAD]H@LIBG`ELAPYAUB@CEB@CMC@MIB@GkB@ECAIB@NwBMEUJHNSDFFNALLS@@HZBBFYBJP[BHTCND@JMZ@FDGJHDH@GHAABCKAIPPFONEJNHEHHDEFFDADBFMP@L'],
                    'encodeOffsets': [[
                            119329,
                            40782
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110105',
                'properties': {
                    'name': '朝阳区',
                    'cp': [
                        116.4977,
                        39.949
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@bFGHBHFBFIVFHHG@@FFB@HDFF@@FRB@LXGt@DHCH@PBDLFBNF@BEXCHEX@ZQ\\@LCPOJCDEAMFEfQLMHCAFH@@KhUNE^AAEHCFDNGVODMI@AEKADEN@CSJw[HCEFQGBBOG@@CE@FOKBDGCAD@C[FCGIB@IE@K^BDOIAEMMIJEDKF@[UMB@GF@EEAUEABSQ@CA@EY@FJI@CHGD@FS@@CAFCACFSCCDCMSHBIECMB@D]@@MKCDCQEAHG@CCG@CGUEIJK@SPOCCNEDQBDNDB@DJCDLFCBBALJB@BVGPBKVO@KHCCCD@FE@BNA@FNCTDDJA@FGB@NBDW@CL@hT@@ZHHQDDDAFSAANBC@HG@EFS@@DE@@PCB@Ue@CADNJB@FCBWA@LI^ix@FIHrH'],
                        ['@@HUNAJKADGECBCMAG^E@EbI@BEGPKrJEH[\\B@FF@CHFB']
                    ],
                    'encodeOffsets': [
                        [[
                                119169,
                                40992
                            ]],
                        [[
                                119398,
                                41063
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '110108',
                'properties': {
                    'name': '海淀区',
                    'cp': [
                        116.2202,
                        40.0239
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@plDJVLGPBFHjDbHGL@X\\DBNHJREBLRBHaFGMGOBQAWPBLCBBAJBDFADOIEJGE@@EP@HCPWP@ZgfBRQJJ\\D@HLHLDVA@IVDFGSI@EGC@EBB@CN@@IZCAGHGaEqGJG@EjwJ]@K@GSA@e_I@NE@CA@Kg@KC@ENCFAKQAW@WIMK@V@I@@F@^EDFB@HcIaDYCBRRDCHD@EFLN@FE@CJUPEJOJMTBPEDIFCMIAKNOGMRFJNDVBFLSRMJSDGJsFcEiJGDGTIlOjYD'],
                    'encodeOffsets': [[
                            118834,
                            41050
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110106',
                'properties': {
                    'name': '丰台区',
                    'cp': [
                        116.2683,
                        39.8309
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@hMN@NFTQCFRCBJFA@HJ@@HJ@HJ\\FTACD@@UNLXJX@@MA@@IECAQlDFEHBDI~D@GXCFMVDFCH@@NF@ANJC@FnAB@AMF@@EDCDDLGP@LUOAUH@AIABKAAEDCKID@CCACMWA@EGDEILA@OK@AELEJBFEEGL@BSOA@EuAFmMACbG@@EM@ANS@ENFDAHSDCL[BEIUBAII@A[E@OaKD@FAACTGVIACDHDAFGAEDoGEFACM@ig@@QFCMKMU@]SCoBGSMQDEXXDWPO@MKYGM^AdJJA\\cNB\\G^DNHFCBFABDBJ@PL^D@DF@T@FDAF^A'],
                    'encodeOffsets': [[
                            118958,
                            40846
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110107',
                'properties': {
                    'name': '石景山区',
                    'cp': [
                        116.1887,
                        39.9346
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@NQPHLMJBDNJEFCAONSPIFIVODIF@@EKMFEC@DGQCAQZDbCdJ@GEAFC@]@EJ@DCSB[EGII@@GI@@GEBAIQDDESRMEM@gNYTIRKJAJEJ[DFJKLGBGNBJLDCDAHGBJJAFBLEXTLZFBAFDLD'],
                    'encodeOffsets': [[
                            118940,
                            40953
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110102',
                'properties': {
                    'name': '西城区',
                    'cp': [
                        116.3631,
                        39.9353
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XBDA@EIACM@IJAD]BC@SFABISAD]H@@OAEDQEW@BLEMD@FLDh@@LDBF@@M`J@fTB@H'],
                    'encodeOffsets': [[
                            119175,
                            40932
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110101',
                'properties': {
                    'name': '东城区',
                    'cp': [
                        116.418,
                        39.9367
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@DBf@@VDA@OF@@CT@FEH@@GADBMTBBECCRCGG@YS@@gDK@AC@PG@C^TBAJEB@TADC^IB@J'],
                    'encodeOffsets': [[
                            119182,
                            40921
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110104',
                'properties': {
                    'name': '宣武区',
                    'cp': [
                        116.3603,
                        39.8852
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@RBX@RFFCBFU@aK@WA}CCJGAEFkCBRFD@JB@@N'],
                    'encodeOffsets': [[
                            119118,
                            40855
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '110103',
                'properties': {
                    'name': '崇文区',
                    'cp': [
                        116.4166,
                        39.8811
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XBL@@bEVD@BX@AC@MHA@EIBCCDSEMmB@EIDBME@@MG@EDUCENWD@H'],
                    'encodeOffsets': [[
                            119175,
                            40829
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/china_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': 'xin_jiang',
                'properties': {
                    'name': '新疆',
                    'cp': [
                        84.9023,
                        41.748
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ρȁôƧƦóəʵסʵóƪԫʵѵͩƧͩړυࡓɛʵ@ȃ@óᇑѵƨɝɚôóНѺͩɜ̏ԭʵôƧɞñ@υƩ݇ȂóƩƧ@ѵȂυƥŌਗ॥ɛóʵѵƧѹ݇̍ࢯəɞυρͩ̏óਙƨƧŋôōó̍ͩóʵןóŋړͪƧѶ@ɜԭԫƦɛȄ̍ɝȄöςƩȂ̏ñȀ̏ƩóóŎə@Ő̎@ɞȀɝŎôƨóנѵȄƧ@óŏɝóɜôŎ̍ͨςŎ@ƨóôƨɞ݈ʶóƨφó̎Ȁƨ̍ԮòѸԮמ@ѺȀ@ƪၬֆòȂñ̐òȂɜóƨ̒Ŏ̑߼@φρȀ@Ő๐ς̎Ƨφ@ɝφڔ೦Ԯǿࢰ@ƦŏԮƨƨȄƧ۬ɜʶڔŐɚɚóŐôƨ߼ôƧƧó̐ƥóŏѺǿƦȁφƧςƨƧ̒@ɜƥƦυ̐ɛƪͩƩəƪʷ̑ə@ȃƨʵנŋྸōਚԭԪ@ɝƨŋ̒օςʵôƧ'],
                    'encodeOffsets': [[
                            98730,
                            43786
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'xi_zang',
                'properties': {
                    'name': '西藏',
                    'cp': [
                        88.7695,
                        31.6846
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôŌנôʶ̎ͪôóŎƨŌਚƧ̐ôςͪφɚɝࢰ݈̎ѺѶƨôʶ०ɜਘƦŋφѶȁ̍ôŏɚŋ@̑ə@ŏò̍ɜóƥôʷƧ̍φѹԪ̍ע@Ѹʷɜ@ôñנ@Ѷɛɞô̐ŏѶƨѸƧƥōƦôŏô@ƧôƩ̒ŋƨŌƦǿô̎ɜȁ̒óʶѶôôО̒ςƥɜНφσɛȁ̎υƨఱƧŏ@ʵƥ@ŌóóóͩƨƧóŋ̑õóɞóɝԩͪɝρôƧ̍ƧѹͨڑŎ̑ōóƧࢭͩ̏ѵɝóఱóóԪυô@̒ƥŌ̏Ƨ̑Ȅ݇ŎƧѵӏ@ɛõŏɛȄôӒƧŌѵǿɝƧŋԫ@̏ʴƥ@óǿ̑Ȁóǿ̍ςóóυô@ʶɛñρƦƩŐó̎óѵó̑ͪࢯОóɜןƧ̏ƥȄ߻̎̏̐ןŎɝɜöɞƩȀôöɛȀóͪ̐ƨƪ̍̎ȂƥԪυО@φɞôƪ'],
                    'encodeOffsets': [[
                            80911,
                            35146
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'nei_meng_gu',
                'properties': {
                    'name': '内蒙古',
                    'cp': [
                        117.5977,
                        44.3408
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ኊȁ૊ö߼ƩɜɛנñԮɛѶóԮô@ȁѸóמ̎ගѺၬ@߼ʶԮӒ߼̎@ŐѹӒ̒Ԫƨöග̑ѶȄ̒ς।ѶɚöɞɜʴڔôôȂ̎ѺȀςƨƪóԪɜôɛОਕڔԭѵ̍ѹȂԫɛƥ̍Ȃóɜ̎ô@ʶ݊ੲࢮʵږͪנƨôȂƧ̐ͪ@ŐƦƨφԬѶɜôƦ@ŐƧôôƦəŐ̏@ŐڒѶԬô̐ʳԩНςōôŏɞ@ƨȂѶəóƧ̒ػ̎ó̐Őנóƨô̒@ƨɚɚ@עԫɛɛ@ȁυͩƥʳòևρ̑ࡗƧͪ༃ॣԮփ̎Ʀ@ôô@ôō@@ȁѵóƨ̍υȃóʵɛƨƥóυȂóəƪ̐ρƧͩɜԭڔȄ̎عƧȁ̐ŏó̍ɛƥƧ̑óρŐ@Ƨ̏ɝəɛ߻ͩ̍ͩɝО̍ƪƧóóӓƨóƧʳ݇@ɝςƪ@ʴƩƧƦôƨɛȄəƧŋυóͩѵ@ɝǿóŌן̍ɛóО̍̑̏ôȁ̍ŏòȁñóƦͩ@ǿə@ɛƧ̑ρȁυô̍օѹóȃə@ȂσʵѷƪòƩ̍ôó߻ۯôʳƧóõʵѵóѹɜ̍ȂѹôɛŌφֈƩͨρóυӑóޟఱ̑݇ͪóƪƨŌóȄڔԬƩςםñ̑ȃѵŐԭŏƨȁɛǿρôõɚɛóƧОə@ѹ̐ѵöԪͨôͪɛ̒ןŏƧƥóôƥƧɛŌôóɝó@̒݇Ӓ̒Ō@Ŏԭࢰ'],
                    'encodeOffsets': [[
                            99540,
                            43830
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'qing_hai',
                'properties': {
                    'name': '青海',
                    'cp': [
                        96.2402,
                        35.4199
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƨ@ôƪ݈ȁƪ@φɝòóƨԮʶɛ̐ѹͪôОəóƧɞᇒѶ@ôږô@ǿѶƪȁςɜͩφςŋɞôѶɛƨŌɞ@ɚςŐñԪॢͩƨȂɞóƨŐ̎ŏעӏ̎óƧƦô̒ȁɜςͩ̒ɚɛƨôƨɝφɛóȁƨŋóóɚͩƨóóƩ@ƧəŋƦƩ̍@ƧƧôǿυ̑@ȁɞǿõŏρƥסɚƧóτԫɞôƧƦ@ñȃòñƥóυôôѹѵ@ŏ̏Ȅɝó@ȂəŌóəѹƦ@Ő̍Ōυ݈ԩŐƧóôƧ̑ôʵɞƧ̑ѵôƩɞƧ̑óНѵóôʵ̑ɛȂó̍ƥȀƧŋ̑Ōóƪ@ƨóóŐƥƦŎѷƨѵƧ̏Őɝóѵɜן@óòɛ@ѷʸס@ԩ̎υѺƨ̎óʸôƦɛñ̎@Őɚ@̒əŌóŐ̎'],
                    'encodeOffsets': [[
                            91890,
                            36945
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'si_chuan',
                'properties': {
                    'name': '四川',
                    'cp': [
                        102.9199,
                        30.1904
                    ],
                    'childNum': 21
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôôŋó̑Ԯ̒ɛОמͪƨōöͫ߼ƥôȃƨóóñôƧóƧôōڔŏƨŐ@ŎôòƥѺŎ@ōɜóנôǿôƦôԮ̍ɜôɚƧñɛɚȁ̍Ƨɛևυ@óóôŋρԭɝ@Ƨʸ̍ŏυɜƧƧóƧƨȁρ̍ƨȃɚôʵφóô̑̏Ȃ̑ʵɜʵɞ@ƨʳסƩóŎəóɜƧôƩƧρóôôô@ŎƧƨƨƪѹó̍̍Ʃ@̏ѹНôޟ̍ƩóƪυɝɛəƨôŎɛȀ@Ȃ@ñɝʶ@Ōρנ̏õóɛͨƨȂѵОɛʵ@̏ƩŐó߼Ƨల̍φɜȂυτɛОρƦɝƨóƪ̒Ѷɝƨóʶ̒óƨƨôԪŏφ݇̎ŋ@ŏѺƥôɚɚŋ@ȁɞô̐ȃ@ŐѶóѺφóƦôñòòȄ'],
                    'encodeOffsets': [[
                            104220,
                            34336
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'hei_long_jiang',
                'properties': {
                    'name': '黑龙江',
                    'cp': [
                        128.1445,
                        48.5156
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ᇔȂਚНƨŐѶŏöƥςŏñƧƦóƨȁ@óƨóȁφӑóóƨóǿ̎̑ôНɞó̑ɜə߼̎ǿ̒ôڒӑφ@Ƨȁ̎̏ƥƩ̎ρశôȂςƨφ@נɞ݈̑ƥƧɛƨʵƧȃƥ@Ƨƥ@ŏ̑ԩôɝρρóɛƧƩͩƧó߻ʸ̍ʷѹƥɞڕõ̍öɝυ̍ȂƧ̐̑ŏóƨñŋѹóóȁ̍̏Ԭõʸ̏ŏ@ǿ̍@ƧОυ@ñƨòȀƥŎ̑ŐѵóɛŌóȂԫōƧŎѹñ̍ʶóОן@Ƨ̎Ѷô@Ȃ@óŎó@@ó̍ƥԭք༄।ƨͩ̒ࡘςñֈƦʴφͪ@ȂɜɜסԬə@Ƨə̑@Ƨóןô̏ŏ̍ô̑ؼôƨѵɚƧȁɝ@óŐρŎԪО̏ʴ'],
                    'encodeOffsets': [[
                            124380,
                            54630
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'gan_su',
                'properties': {
                    'name': '甘肃',
                    'cp': [
                        95.7129,
                        40.166
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ڔôԮࢯ@ō̑ŋ݈ӑ@̑ɞôóôɜŋƦƨôóƨƦנŐɜ̑óͩԩͧѶõѺ̏ɚ@ƨНɜôöəςóɜȀƧȂԮŐѶŏ̒ȄמòƪρړԫôȃƧŋôƩ݈ͩɚ@@ǿɜ@φͩóŏɜӑƧōôǿ̎ôƥƪóõö@ôƨôƧƦôó̒ɜ@ɞŌõʶ̏Ő@ȀóôƨȂ@ʶע@@ƥ୾ӑó̑óŋôʵóɛړ@@ƩöóƩóρɛƨ̑@óʷƥƥ̎ɛƧôōƧǿôͩѵôɝȃɞȁõƧρóó@ōƧŏړŐóŎôƨóƨôòƧôóȄ߻ƦõͬƧŎםͩɜНԭ̑ô̒óŌóƥ@óƨɝσԬƨôעəςƦöŐɝȀ@Ȃφ̒óȀƨƨ̎@ƥƪɚŌ@ƨôƪƧôəͪôôƧŌôȂυɜƧɞƧóəɜ̑ρͪɛ̑Ȃóƨƥ̍ôסӐ̍ŐƧŏɝôƧȁॡͪòԩρŏ@əɝƧŋѵɜɝóρŌυɛͪρƩȂѵ@Ȁڕó@ȄɜʶφࡔڔƨͪѶͪԬʶôƩעʶɚʶƥôóƨςȂ'],
                    'encodeOffsets': [[
                            98730,
                            43740
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'yun_nan',
                'properties': {
                    'name': '云南',
                    'cp': [
                        101.8652,
                        25.1807
                    ],
                    'childNum': 16
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôɞôɝ̒öôŌƧƨôͪôô@ŋƦ@ʶƨŐô߻ƪŏ@̐ɜʶѶНƧȁɜͧöô̐ςן@ŋɞʵ@ò@ȁɜǿóōɚƧɜφɞôƩ̎ƪóޠѺО@̐̎ƪô̎ѺƧƩƨƧ@ōóóôóςƪƨƨóôɛó̑ԭƥŌɛǿɝƨɛͩô@ǿƨȁѺŌɚɛ̍ןѶНɛƧôóƥȁƦͩôŎɞƨ̑ɜòôφ@ƨʵ@ɛѹōóȃəƨυǿóʵρƧƧŌƩɛ̏ȄñƧƧȀɝ̍ԩʶƧ̑υóŌƥʳɚӑóНƥô̑óӒѵʵѹƧӐןôƪφõŌƪ̒ԫŌƧؼƨƨסρȁƧƨȂóʶó@@ʴƨôôφ̎Ŏ@ȀƨƪɚƨóƨôôôςóޤƧŌƩŋƧԪ'],
                    'encodeOffsets': [[
                            100530,
                            28800
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'guang_xi',
                'properties': {
                    'name': '广西',
                    'cp': [
                        108.2813,
                        23.6426
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƦŋѺ̎ڔʵƨŐ@ƦמȄƪôóȂɜŌɚͩɜ@öóɜôôȂƦôɜȁ@ɞφóȄ̎ƨʶɞŋƨʴɚǿ̐̎Ԭ@ôñ@̏ƨρ۫ôɚƨƨНƪŐ̎ƥóƦʵƥŋ@ȃóƥƧ@@ŏɝǿôυƧȁѵɛ@əóŏ̑@@ə̍óƧó@ȁƩρóòНƥô@Ӓ̑@óŎ̍ƥσŎυ@̍ƨ@Ō̑ôóͪƨ̒óŌړ̏Ŏ@ŌôȄѺŎ@ɜƧʶυ@ñóɛƧ̒ɝóōƥͪ'],
                    'encodeOffsets': [[
                            107011,
                            25335
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'hu_nan',
                'properties': {
                    'name': '湖南',
                    'cp': [
                        111.5332,
                        27.3779
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@քɜОƨ@öŐמóƪôƩɚ̒Ő߼ȁςͩɜòƪɜȀòñɝòѺͪ@ŏƨŋóɝôǿƨɚȃóəƨȃѵͩó̍@ȃƨóóƥƨƧ@ʵƦóͩɜɛóñԭɛōυȂ̍ƧƦō@ɛƥɛȀ̑óʷóō̍ƩŏƧОəƧóς۬Ƨ@̐óòԫ@̏̍əȀƧʳɝŌóɞƧƨɜóŐƨò@ȄƧŌρŋóôԪОóʶ@̎óȄ'],
                    'encodeOffsets': [[
                            111870,
                            29161
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'shan_xi_1',
                'properties': {
                    'name': '陕西',
                    'cp': [
                        109.5996,
                        35.6396
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ςôöƨɝȂɞȄѶóóͪƨȀóŎƨ̍ɜƦƦôʸ̒@ɜƧςƪôõô@ƪڔ@ôɜóʶôŌô̒୽Ӓ@Ʀ@Ѻ̎ɜѺɛѶôöʶôƨóʴ߼۰óô̎ñƪѸƩτʶ@ȁòŋəѹóǿ̑ʵ@ȁ̒ʷυփô݉ôН̏ط@ȁƨóô̏ƪõ@ʳ̐ʵ@ɝɛŋƩŌɛóןôƧŋ̒ó@ŏ̐ƥ@ŏυ@ƧƧôן̏@ƥȂѹɜəɛóԭ̎ƥóóóȀןɛô@ŎѹōñƦ'],
                    'encodeOffsets': [[
                            108001,
                            33705
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'guang_dong',
                'properties': {
                    'name': '广东',
                    'cp': [
                        113.4668,
                        22.8076
                    ],
                    'childNum': 21
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@@Ȃôôƨ̎@ɚ̒@ôŐ@ɚѶɜƨȂóφɞȀ@Őƨ@ôƦ@ȄƦŌƥʶƦôôŎôʸ̒ɜǿƦ@ɜƥŎ̎ƨφȁɜŎòƥԮŎƨōóŏɛƧɝəɞƧ߼ɜςȃñȄƦŎ̒ōôòƨəƨɚН@əƨ̏ƪʵυŌəɛóəԭŏəóŏѹρʵɝƦ̏ƥʳѶöō̑óóŋρȀυƧƥɛѹōƧôןɛŏѵ@óŋôʵɝƪԩõ@Ƨō̍@Ƨ@@ƦɝԮƪО@@',
                        '@@X¯aWĀ@l'
                    ],
                    'encodeOffsets': [
                        [
                            112411,
                            21916
                        ],
                        [
                            116325,
                            22697
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'ji_lin',
                'properties': {
                    'name': '吉林',
                    'cp': [
                        126.4746,
                        43.5938
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@נ@ôН̎ʵѺòƨōԬŎôȁɜŋѶô̒ŏƦōñǿòƧφ@ƨН̎@@Ȁ̐Őöʷ̐ԫ̎ôȂѺôòŌôƧ̒Őƨ̏̎ȁφ@ŋƩͩםȃƨ@ȁ̑ʶ@Ōóôɛƥѹ̑συ݇@ɜρƧȃࢯƨôəȂɛōƩɛ̏υρóõƪʴυφ@ʶôŌóρք@ɜƧ@ɝǿƧͪρȀƩó̏ŐƨȂ̍غړȃɛԮƨͪ̏ςƩôɚφȁƦôɜƧôʶφȄ'],
                    'encodeOffsets': [[
                            126181,
                            47341
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'he_bei',
                'properties': {
                    'name': '河北',
                    'cp': [
                        115.4004,
                        37.9688
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Ʃ̒̏ŌѺ̒ƩóȄƧŌƥͪòôñȂ̎ŐóȂ̒̐̎ôНɜנ̎ôŋɞȀѶ@ôͪφƨŌɚɜȃóƧƨƥƪ@ʳƩɞρ݈@υНφʵɜƦρƨƧ̍ɝóɛѹ̍ρŏ̑ôóƨ@ƧƦôƨɛ@ƥƨ@ȂƦ@@ôəŐƧʶƨŌυ̍̎ɛŋôōɝ@óƧ̍ƦʵѵʳôʵɜŏςôƪŋƨŌɚ@ôНƥƧ@ōѸɛ̐ô̎ʵѵНԭ@̍̍Ƨò@ȁɝ@əρυͩƪ̏ƩõƧŎƧōóॡȄɛʶɜȀ@ɞςѶƧƥςɛŐ@ɚɜɜ@Ŏôôςƪς'],
                        ['@@õə@Ƨɛ@ŐóƦφô']
                    ],
                    'encodeOffsets': [
                        [[
                                117271,
                                40455
                            ]],
                        [[
                                120061,
                                41040
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'hu_bei',
                'properties': {
                    'name': '湖北',
                    'cp': [
                        112.2363,
                        31.1572
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ñȄυƦöŐƩóנƨƨφ@@Ő̏Ʀ@Ő̑ôƨŌנóɜôƪŋɜŌѶօڔə݈òɞōɜŎôӏƦóƨô̒óôȃƨó̎ŐôƧƪ@ƨȁςƧə̑̎Н@̍Ƨŏρôԭͩԫ̍ʵƧóȀôɞƧŌ@ŐѹͩñòɞñɛǿƩɛñρͪ߻Ȃ̑ŏƪəƩóםôõŏƧ@ɛНƥȄó̑ѺƧôφóƨƨƦƪóɜŐôóòôƨóφ̐ƨóƦ̎'],
                    'encodeOffsets': [[
                            112860,
                            31905
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'gui_zhou',
                'properties': {
                    'name': '贵州',
                    'cp': [
                        106.6113,
                        26.9385
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɜȀƦŋԮô̒ɚôōעƪƧʴɝ@ɛʶ̒ʶ̐ȁƦóȂô@ôŏ@ōôƨʶѸô@ʶƨɞó@ōτöòυƨ@@əƨô@ɛ̒@Ʀɜôȃ@̍ôʵԩНôóςŌƨŋ@ȃƧñôŏƧɛƨôɝƧʵ̍ôȃυ@ɝɛȂƥóóȁɛóõôɛ@əͪɛŋôȁƩóםȃ@ƥƧŏړʶѹ̍ƥŌƦȂóôɜƨѵО̎נəɜѹŋƧȂ@ȀóɜͪɞƧ'],
                    'encodeOffsets': [[
                            106651,
                            27901
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'shan_dong',
                'properties': {
                    'name': '山东',
                    'cp': [
                        118.7402,
                        36.4307
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ʃ̐φͪɚςɞ@@Ȃƨñ̎̎Ԯ@ѶОƨƧڔ@φН̑ŋ@Ʃ̒ǿ̎@ƨɜԬςôʶ̐ʶöԫƨƧנƥɜŎôō̎@ôŏóρƧŏԫôóƧԩó@ƥɜƧԭóƨʵɛƨ߻ӑɜНԩóô̑óƧʳəóɛƧ@õȀƧ̍ȃɛŐóŏυО̍óɝƩԩ@ƧɚԫȄɚʶƨɞʶԪ̐ړɛƪ̒'],
                    'encodeOffsets': [[
                            118261,
                            37036
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'jiang_xi',
                'properties': {
                    'name': '江西',
                    'cp': [
                        116.0156,
                        27.29
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƧȄôɚəȄ̎ʶԬԮͪςóƨŐƪτɞƦōƥƧ@ŏςôóŐôô̒ʷѶƪƩƩǿ@ō̒ɛôυ@Ƨȁѹɛəƨѹ̑ƨ̏óƥѵʷô̍ɛȁôŏɝǿƧԫƧôʳƥōòȃρȄ߻ɛɝƨɞɚɜƨôŐƧŎԭōñƦòԮɜôɛôͪƥ@ʶƧƨôƦƧô@Ȅô̎Ѷͪ'],
                    'encodeOffsets': [[
                            117000,
                            29025
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'he_nan',
                'properties': {
                    'name': '河南',
                    'cp': [
                        113.4668,
                        33.8818
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@φ̎ƪ̐ɞȄɚ@@Ȃעó̎ŌѺ̒ôֆॢȃôƨŎƨōƪöƩ̑ڔɜԩ̏ɝʵƧəʵԬȃƨəԪ@@Ƨ̒ŏô̍υȁƧɚ̍ôóŋ@ɝƧŋõ̑σ@ŏɜŋôɝ̒ƧɚôôطρóóɛƩ@óƨ̍ŏƧôóȄ̑ôƧóƥôóӐɛōɝŎ݇ñړɚѵֆ@ɞ̏ʶ@ʴƩöó̐'],
                    'encodeOffsets': [[
                            113040,
                            35416
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'liao_ning',
                'properties': {
                    'name': '辽宁',
                    'cp': [
                        122.3438,
                        41.0889
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƨʴƧôôӔƨô̎ƩɞН̎ͪ߼ͪɜɞɚ̐@ƨςŏ̒ôƦƨɜô̎ƪôςǿƨͩɞȀƨ@@ɛςփôóŋ@ʵφυƩʳö॥փρѹס@əɛ@ͩࢯ@ѹʵρƩʶφȀƧ݈̒۬óʸɝŎѵ@ԭԫןɛƧƨƥςɛυʶφО'],
                    'encodeOffsets': [[
                            122131,
                            42301
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'shan_xi_2',
                'properties': {
                    'name': '山西',
                    'cp': [
                        112.4121,
                        37.6611
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɚѺñŌɚôȄѺ̎ֆφóςȂ̒ɜƨɚ@@Ȁƨŋôȃƪѹ̑̐ŋƪ̑Ʃρρóó@ōɛɛ@əɜŏƦρƨρѵ@ɝɛǿɜʵóօѹ̑̍ŋסô@ȁə@ɝȃ̏̍ƩυƧô@Ȃ̐ظóОó݊φք̑ʸ@Ȃ̒ʶôȀ'],
                    'encodeOffsets': [[
                            113581,
                            39645
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'an_hui',
                'properties': {
                    'name': '安徽',
                    'cp': [
                        117.2461,
                        32.0361
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ó̎̑Ő@ƨƪѶǿɜ̑φƦʵ̐ƧѵôóƪôôυςƨȂɞŏ@̍ԫôò̑ƥóȃѶͩƧƥôŏѺôŏƦ@ƥͩƧôȁυó@̑ƧɛѵʵƩƪѵ̑ʸóóôŏρó@ŐƦƨƥŎσɝƩ@̎̍Оɚ̒ρƨƧȂôɜςôóظəó̑ƨóɞɛŌ@Őτö̒ƨŌ@ɞôŌ̎óƨəφȂ'],
                    'encodeOffsets': [[
                            119431,
                            34741
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'fu_jian',
                'properties': {
                    'name': '福建',
                    'cp': [
                        118.3008,
                        25.9277
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̎óȁƨӑ̒̎ɚƨͩφŐƨɝ̎ŋóŏρ@ōƨòʳəóƨō̏õɛƧ@ƨѵƧōəŏóŋƧô̑ɝɛʳƥ@@óɛõ@Ƨ̑ƧóȁəƧ̑Ƨ̐@ɚəОƧƧɚóñ̑ŎóʴƨƨԬɞȀóŐɜȂó̎ѶʸôƦƧ̐Ѻ̒ɚƧѺɜƨȂ'],
                    'encodeOffsets': [[
                            121321,
                            28981
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'zhe_jiang',
                'properties': {
                    'name': '浙江',
                    'cp': [
                        120.498,
                        29.0918
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ѷʶƨɜ@̒φôóȂƨƦͪ@̐Ѹ̍τȂ̒̑נŐמôƪƧôӑ̑@ƥρͩƨօ̏@@υɝó@ŋɛ@ôƩəóƧѵυó@ƩɜŋƧ@̍ŌƧɞυŏƧͪ̍ə̑ƧӒôȂ̍@óφ̑ɜ@ŎƪȀ'],
                    'encodeOffsets': [[
                            121051,
                            30105
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'jiang_su',
                'properties': {
                    'name': '江苏',
                    'cp': [
                        120.0586,
                        32.915
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôɞ̎φНôŐɜŏ̎Ȅƨöǿƨ@ôɜɚƨʴ̒ôôó@Ƨ̎əԮȃԪૉöͩ̐ƧòʵφƧôʵ@óړɜóŏɜǿƧɝρσȁѷ̎̏ƥóŐѹóŐƨƦѵͪôȄƦñ̒Ԭó@̎ɝŐƧȁρóφƩóóôƨѶ̏ƥʶυɛ̒ѵȀ'],
                    'encodeOffsets': [[
                            119161,
                            35460
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'chong_qing',
                'properties': {
                    'name': '重庆',
                    'cp': [
                        107.7539,
                        30.1904
                    ],
                    'childNum': 40
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@əȂòɜƨѺɛƦȁ̐@ƪõŏφƥòȃƥ̍Ƨôυ̏ƧôñóóôɛŏƩôƧƥôƧóυƨ̒ѹôƦȃ@փƥɛ̑@@ɜƧó@ɚƧ@ñφσõ@ŎɝôƧ@ʵѷóƧʵó@ŎóŐó@ôȁƥó̒υôóʶəƧȄς̎ƧȂôƨƨƨφɛ̎Őƨʷɞ@ςԮóŌôôφ@ɜֈ̎ƨ'],
                    'encodeOffsets': [[
                            111150,
                            32446
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ning_xia',
                'properties': {
                    'name': '宁夏',
                    'cp': [
                        105.9961,
                        37.3096
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ల̒ôޠφӒςôƪͧυևɜŋѺó̎ȁ̍ɛ@ѹס@@ʵƧȁôó@ǿ̐ŏöʵɝŋɛ@ô̑ƥóóƨƧóôó@ƩôóƦ̍óȀƨŎɛӒôŐυͪɛ@@Ȁə@'],
                    'encodeOffsets': [[
                            106831,
                            38340
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'hai_nan',
                'properties': {
                    'name': '海南',
                    'cp': [
                        109.9512,
                        19.2041
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@φɜƦʶ̐ôφô̎@ƨŎö@τʵƦԩ۫õН̏óƥȃƧ@Ʃəםƨ̑Ʀ@ޤ'],
                    'encodeOffsets': [[
                            111240,
                            19846
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'tai_wan',
                'properties': {
                    'name': '台湾',
                    'cp': [
                        121.0254,
                        23.5986
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôƩɝöƧɝѵəޣ̏ρƩԭóōóͪρɞƧОôԪ݈ଦѶɜ̒ɛ'],
                    'encodeOffsets': [[
                            124831,
                            25650
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'bei_jing',
                'properties': {
                    'name': '北京',
                    'cp': [
                        116.4551,
                        40.2539
                    ],
                    'childNum': 19
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@óóóυóôƥ@ŏóóə@ƧŋƩŌρóɛŐóʶѶʴƥʶ̎ôƨɞ@óŎɜŌ̎̍φƧŋƨʵ'],
                    'encodeOffsets': [[
                            120241,
                            41176
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'tian_jin',
                'properties': {
                    'name': '天津',
                    'cp': [
                        117.4219,
                        39.4189
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôôɜ@ƨöɚôôôɚŏ@óƥ@@ȁƦƧɜ@óƧƨƥ@ƧóəН̏óѷɜ@ŎƦƨóО'],
                    'encodeOffsets': [[
                            119610,
                            40545
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'shang_hai',
                'properties': {
                    'name': '上海',
                    'cp': [
                        121.4648,
                        31.2891
                    ],
                    'childNum': 19
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɞςƨɛȀôŐڔɛóυô̍ןŏ̑̒'],
                    'encodeOffsets': [[
                            123840,
                            31771
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'xiang_gang',
                'properties': {
                    'name': '香港',
                    'cp': [
                        114.2578,
                        22.3242
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@óɛƩ@ρ@óôȀɚŎƨ@ö@@ōƨ@'],
                    'encodeOffsets': [[
                            117361,
                            22950
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ao_men',
                'properties': {
                    'name': '澳门',
                    'cp': [
                        113.5547,
                        22.1484
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@X¯aWĀ@l'],
                    'encodeOffsets': [[
                            116325,
                            22697
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/chong_qing_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '500242',
                'properties': {
                    'name': '酉阳土家族苗族自治县',
                    'cp': [
                        108.8196,
                        28.8666
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XJ°lJX@lbl@XbV@VLnJlxnbUU@IVK@lVIVwnJlU@n@J@L@Jn@l_nWVLVln@@blLmV@@xÔ`nxVÈLlxLVxVVV_U»VWn_m¥XwVmnX°lmUUVwÞaVk@a@mmIUa@mwk@m@@U¯a@UV@@K@ykkmwkV@kU@ÑVkKWLÅamaUm@kyU@WkU@UaIUaVaUUmUUa@aVLXKWa¯UUbmJXnWnX`l@@xkzWÆ@VLU¦x@b@JkIkJ@LmbUamJwm@óxnk@V@xVnUVmVUVUbVlUbkXW'],
                    'encodeOffsets': [[
                            110914,
                            29695
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500236',
                'properties': {
                    'name': '奉节县',
                    'cp': [
                        109.3909,
                        30.9265
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WVXbUnK@x@b²kxmKkl¯_VV°VU@bnKVVV@@nk@nbn@°@VLČU@°WV@VnU@InKVl@nUbKnXWlknLlKUwnalLaVlUXmWk@UU@UWWIUyķ¹XaWW@XKUIVmU@W@UVU@KV@n»VkUkÇmUmVIUmULUbm@wUaKkkm¯ÑUL@bWVnx@VmxUI@klmkkK@aK@IlJ@I¯k@mak@mnkJVL@bV@UbW`UUUVI@VU@VVbUJVLUVVbUXVVxk¦VJUnVxnVVUJV@Ubl@@bXV@L'],
                    'encodeOffsets': [[
                            111781,
                            31658
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500238',
                'properties': {
                    'name': '巫溪县',
                    'cp': [
                        109.3359,
                        31.4813
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nLWbXVLVUV@KIVl@b@lbUVnU@JÆU@V@n°KĢUl@VbÞKV@_VKXUU@KX@wlkkU@mWKUU@UôJ@XV@aVmÞIVaVL@»km@UkLU@aU@WWLUUUKkbwWa@KU@kaXmWLamVk@UmL@JmVUU@¯X@ċVUK¯@ÅnWKLkKULWK@UXK@wW@LkV@bVLlXn`¯xU°LnlV@n°Lnl'],
                    'encodeOffsets': [[
                            111488,
                            32361
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500234',
                'properties': {
                    'name': '开县',
                    'cp': [
                        108.4131,
                        31.2561
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@naIw@@VVKLVbVxnVÆUnanKWXamKmk¯K@mkUm¯KV°w@Wm@UIUUlKUU@a¯KWanwmUXamKkUWUnU@KkUwWKXaWLUWkImaUUUKka±k@l¯wwmbUkXm@UJkIWXXbmUJXUV@°KllVXV@xmbnV@blV@VU`UL@Va@bULlb°VXbÜ@V@bL@JxnLVb@lVb@V@@zbXWXKVLV@@bUVVL@blVna@ll@zl@@J'],
                    'encodeOffsets': [[
                            111150,
                            32434
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500243',
                'properties': {
                    'name': '彭水苗族土家族自治县',
                    'cp': [
                        108.2043,
                        29.3994
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Jlb@nVV@bXb@ÆlLUl`nVKU¼VxkbWnlUxlXX@°°WnnJ@VUn@Jk°L@VlV@nUJx@bVVVz@VnLlaKnalVlIU¼@nV@@anKUwVal@UlJlI@akU@UWXKVI¯Uak@@KmkXWÜkXWykIWwXw@laXamkVUUym_XmlkkmmakwmIUKU@Wak@kaW@kI¯WIk¦VUUmaUV@XkVUV±aUb¯b¯¥m@@ImJ@mmL@kUKUkkJbV¦'],
                    'encodeOffsets': [[
                            110408,
                            29729
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500235',
                'properties': {
                    'name': '云阳县',
                    'cp': [
                        108.8306,
                        31.0089
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lbLVVVnblJVXXKWbXLVxl@LmVXVVlnLWbnVmxXb°L@bVVkLVVVJn@@X_WmkUK@alUKX@@xWL@VXLVKlLKXLÆm@ma@ml@mU@UUmL@aVUU¯U°`lknLlw±@a@wmLVWaXU@KWU@ak@VaU@IUVmUUwVmUIl¥UwUVWUaVUUKVIUa@UUUUJUUmknl@@VWV@L¯aUbUlx@@b@VULUx@VUxVVU@bU@mxUU@mUVklkk@WxknlxK@amLKUK'],
                    'encodeOffsets': [[
                            111016,
                            31742
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500101',
                'properties': {
                    'name': '万州区',
                    'cp': [
                        108.3911,
                        30.6958
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĸĊVInaWWXlJVIn@lWVnax°xkl@²LVLnK@bLkwlmXw@lllkUnVV@VnwV@@aVUUVw@UVwVK@U@a@kwVVa°b@KXU@U@mkÇÑamlkUVmn@VULUm@kUVkUawUWm@Uw¯mKUUmVUUULUKUW@XbWVkaWwkUUk@maUbmbVlk¦xUVUIWVUkJVVkL@UmJUUVU@lLUVUlx@@VbJUL¯¤@V'],
                    'encodeOffsets': [[
                            110464,
                            31551
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500229',
                'properties': {
                    'name': '城口县',
                    'cp': [
                        108.7756,
                        31.9098
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VK@w¯L@m@UÅV@ImVUVka@@aUkJ@LUUVUKmLmbÅVmUUwUaKUL@U@xJmbm@nVJ@X@VkVnlLXx@b@bUVLU`UnbU@@mVVX@JX@VLVVklV`@bUL@VLVKn@U@UJkn@lmLmK@X@Jn@mbnÞWVXnJkKČÑÆ@VK@knaÜmXlUČW°kôÇÆ@a@yÞ_VmUnU@K'],
                    'encodeOffsets': [[
                            111893,
                            32513
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500116',
                'properties': {
                    'name': '江津区',
                    'cp': [
                        106.2158,
                        28.9874
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@InWUUlU@LValX@°²lÒXxlK@Ul@@Un@UaVJ@I@W@UUUVUwVIUKUaUUVwn@Üx@XUlnnbJ@¥VklKUUlk@ynU@kVUUVWnI@¥V£VWVIUKU@UVa@n@Vm@@nlUaVkUwJ@blLkLW@XWmXkmmLn@m@U@UVm@UVUUlakUVaVkV@@wnaWUk@VwklmVIkUUxmJ@U@KIkx±V@IUm@K@IUKkbWKUbnm@bmVnbmb@xkxUJ@ULW`@bX@WVXL@V¯mk¯@UJ@VmLUaWnX@WJ@nkKkxW@UIV@@KkImmkK@UW@XaWIU@UIkbWbxXlLVbnV@bWlX@VxVLnl@nÆÞVÜ'],
                    'encodeOffsets': [[
                            108585,
                            30032
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500240',
                'properties': {
                    'name': '石柱土家族自治县',
                    'cp': [
                        108.2813,
                        30.1025
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@kl@¼UbmVXJ@bV@nxVIVJULVVk@@LWbnJVU@bVbUJ@blLXnWV@mbnV@Vbn@VJVLnaVanbl@VlVXxlbXUWaX@VUUVwUUVm@I@WmI@amlLlK@alwnUV@kóVaÝk@UlbVK@VU»VUUVWU@U`ULkwm@@KmU@knK»VkJkUmbLkbmK@UUyUU@awm@@XXJ@VVLVVUbVnUJVX@Kk`WXXJWXUbmW@bkLUm`Xnb@JVL@LU@°VVXKVnUxVLUbmJ'],
                    'encodeOffsets': [[
                            110588,
                            30769
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500237',
                'properties': {
                    'name': '巫山县',
                    'cp': [
                        109.8853,
                        31.1188
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kVUbkKmbVxkLmKkllbV@@LXbxlaLVVVKXXV@@bVlKV@ln@¼°KXaU@Ulw°JXalIUaÝWXW@kVU@VUVWUUUamUw@aVamwn@VUUlLXWm£@wÇĉkKklmLUÒ¯Wn@ğ±kwmaWm¼U@@LUV@V@XVUnVJLW@XXWbĸºVzXJVXV@@VXlWn'],
                    'encodeOffsets': [[
                            112399,
                            31917
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500102',
                'properties': {
                    'name': '涪陵区',
                    'cp': [
                        107.3364,
                        29.6796
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nèVblĖVVnL@xVn@nJ@LUVVX@lbUJV@@nn@VVVK@zV@nzVJVUlmX@@_VVVbnaVal@@knW@wnaVK@aVIJ@£kUVW@wXUVJam@Ik_X¥@WwkKkwmkUxnÅmm¥WV@Um@UlVL@JU@@X@UVkKVkKVkKkb@bmJVXUVVUbU@@`W_UV¯b'],
                    'encodeOffsets': [[
                            109508,
                            30207
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500230',
                'properties': {
                    'name': '丰都县',
                    'cp': [
                        107.8418,
                        29.9048
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Þè@XUK@LlV@blbUJ@V@bnV@VVVXU@lbXal@VXnKV@maXUÞ@amk@aVKXVanb£°mnIVaUKVwUmWLUU¯V@@KUK@IaWmn_VlK@anXVaXWWIXWl_@LUWVIUmVaUUUK@UWI@Wn@VI@mkU@U¯Kl@ImVÅLwU¤óbUU@wWXkmm@LU@@VUIWVUL@JUnax@JnbUIWVx@UXlV@¤IUJ@bULmb@xmX@lk@UbmbUaUU@`W@kn'],
                    'encodeOffsets': [[
                            110048,
                            30713
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500232',
                'properties': {
                    'name': '武隆县',
                    'cp': [
                        107.655,
                        29.35
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lwbVm@IVKXUVJ@UV@@KnnWlX@xVVôaV£xÆKnUVm@UmIXm¯¯@WkWVwmkXlaUwV»ULmk_VkK@ÅWa@aUU@mkaIb@n¼nm_@mmK@ULUVVmI@aUJ@XWJ@U`UIkm±kk@@lULmUmKUnVnlUVmI@VkVlxbkIVmLUxkKUXn¦ÆnmVwlnlxlLXx@W¦`'],
                    'encodeOffsets': [[
                            110262,
                            30291
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500119',
                'properties': {
                    'name': '南川区',
                    'cp': [
                        107.1716,
                        29.1302
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VUbVJVUn@VLX@WVXVVI@VUVWxU@m@ĊX@@¼V°aVUX`@_V@VaUUVUWnI@alaLUlLUllLVU@@WV@@IUKVkn@@VlLVwnKUlJakwlU@UnJVUmkUVmXa@wVK@UUw@VVI@ak@alInwlKXUmaUW@wWLkKVak_ÇaUV@XbLVxUlWIk@UK@V@kU@VbUVUlVnLUV@lVXmxkV@L@V@Vk@WbUwmL@JUI@xVxkx'],
                    'encodeOffsets': [[
                            109463,
                            29830
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500241',
                'properties': {
                    'name': '秀山土家族苗族自治县',
                    'cp': [
                        109.0173,
                        28.5205
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XlV@lzn@VnbÆbXKlLUÒV@@llUnxll@z@LU@@V°b@Vn@l@VÑUnK@UU@aUakVm@K¯wklmnnUl`nI@almkIUwmWVkUakkJmUUa@K@aU@@_m@@wUyVUUa@Um@awl@Wka±UkUykIWVb@bUVk@aU@UXUUIWakUWmUxUV@nUVWb@XXVVmXX@VbVLkVWx'],
                    'encodeOffsets': [[
                            111330,
                            29183
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500114',
                'properties': {
                    'name': '黔江区',
                    'cp': [
                        108.7207,
                        29.4708
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VX@V@LV@VJUL@lVnnxlb@VXVXV@@W@UIVK@kUKna@£VWUaVUUalIVJVIUW_lm@bXKV@mn@JUUw@KnIVll@VanLVmUkVKXLVKUIVamw@UaU_lwKlwUWV_Ua@aUa@KUwm_Ó@wU@nkK@am@UkUKmXk`m@@I@K@I@mkVmIUxUJ@kUL@JVVlnklWnn`VzUVnlWbkb@WxXxlJXzWÛlWXnl@Ll@Vb°UJWLX@VlV@bkJ'],
                    'encodeOffsets': [[
                            111106,
                            30420
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500117',
                'properties': {
                    'name': '合川区',
                    'cp': [
                        106.3257,
                        30.108
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XKVXlKVL@UnV@aValXXKU@WVwUaVU@IV@@aVWL@U@anVV@@bVK@UVL@bnJWL@VnUnb@@JnIlVl@@bXIWbn@UKVLVKXLlaV@VVnK@bVLmIV@KmknUUWVI@aVJ@_WU_VmUwU@KVak@am¯mJU_UJUkU@WkIV`UI@JV@LmmU@@mbUzÅ@VK@nUKbakb@UWK@bkVVbVÛ@@`Xk@W@n@lXL@bmb@VVJUn@JnUlnUlmX@`XLlbkJW@kzlb@`@b@b'],
                    'encodeOffsets': [[
                            108529,
                            31101
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500222',
                'properties': {
                    'name': '綦江县',
                    'cp': [
                        106.6553,
                        28.8171
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@¦@XlVX@@UVKlVUX@lanVlUVbXWVXVVVUnKVUlwUwU@UJ@nmVkUVlwXam@VaUUUw@W@kk»mV@UmKkwVKVUU@@LUKVI@mV@XVWxnXVKUUUK@wWU@UUWnUlLXamUIam@wI@K@amImUUkI@makUkKWUUan@wamLVxk@UVmUUL@Vm@kV@I@ak@@bWVXJlLVbVL@@bn@@`Un@WbUKULWVXb@UVmbXWVb@bVmxUKUV@Un@V@V@nmnKlnnWWXX@lKkK@aIVxUlVbk@mn@@U@mbVUV@VLUJUXU¤'],
                    'encodeOffsets': [[
                            109137,
                            29779
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500233',
                'properties': {
                    'name': '忠县',
                    'cp': [
                        107.8967,
                        30.3223
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VLÞĊU@W@¼V@lk@w²mlVUllVnI@VlKUUlIVXUVJVUwl¥UkUKUIm@aU@mUna@XUWmkK@aVIUa@aUVmIXa@Kl@UUVKUIUJmwU@@aWInUVa»k@@l¯n¤mabWUUL@bnl@bÝWVnbU@mLUWk@Wbka@WVUU@UmUmVkUULVlVUxl@L@VbÈÒlb'],
                    'encodeOffsets': [[
                            110239,
                            31146
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500228',
                'properties': {
                    'name': '梁平县',
                    'cp': [
                        107.7429,
                        30.6519
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XLV@VV@b°°nnkb@bnJWVXblIUVxWnUJnVVLVUJlUnLVK@UnUVJ²nKVbVKla@aXlJkKlb@U°£KVIUa@@kwVVUkKV@VUkkUVk±n@xkl@U@»@XVÝĉUJnxWb@UXKkVUbUKWUkVmkkLU`b'],
                    'encodeOffsets': [[
                            109980,
                            31247
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500113',
                'properties': {
                    'name': '巴南区',
                    'cp': [
                        106.7322,
                        29.4214
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nxnVlJlUXL¦@x@Vl@nKVVX@V_V@@KlVXU@lKlxXIl@ÈĊ@Vl@n_VJlnVlnb²VVVJVVmUUkĕUamçU@»W@@ĉnV@XwVU@UUJWUXUW@UKm@UVUIVaUUVmLUVUUUWWXUakVmUkbW@UVkUL@VW@kUW@mJUXVVU@lmV@zklVVkLUl@¦I'],
                    'encodeOffsets': [[
                            108990,
                            30061
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500223',
                'properties': {
                    'name': '潼南县',
                    'cp': [
                        105.7764,
                        30.1135
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@a@a@_kalyX@lIkaWK@_nWVkkmmV@IVmUI@Una@aWK@k@mkbWaknmJUk@mk@@kUal@Ua@Wa@aXLlwUKlkk@KmI@VUJ@Lk@@VUUmL@amJU£kKUaWakLmU@bVVUbnbWV@xkL@bUbxUxVbXJVbUVWIUVU@kLWxkKWV@n¯VUbU@@VVX@VmaUL@VUK@VVbn@lVnI@@lnLULm@Ub@l@na@lK@XVVkJ@b@zl@@VnV@bVb@J@bnXV`lXXmVI@W@InbV@@aVKUblKVLUanLlmnLlK'],
                    'encodeOffsets': [[
                            108529,
                            31101
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500118',
                'properties': {
                    'name': '永川区',
                    'cp': [
                        105.8643,
                        29.2566
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@bÜnWVLXlxVVxXxlVn@@bVblK@a@UnLVJV@@UnLVU@VXaVKVX@n`WUÿ@IUKlaUUUkWyUÛÅÝ@mmkUKUwW@Xk@amUUakKWwXaK@VVLklXVlkxVUL@bm@Vxn`IVxUVkLVUl@@lkXmmVUn@VV@Xb'],
                    'encodeOffsets': [[
                            108192,
                            30038
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500231',
                'properties': {
                    'name': '垫江县',
                    'cp': [
                        107.4573,
                        30.2454
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ċ°¤nÒ¼aV_lKnllUXVVLValULVW@XamwVIUKkaÇÑa@U@KkVwkUUVKlVnU@aU@VIka@akU@KVL@WÝçUV@VmbÅ¯@LKnnJWVkxlL@VX@VxmnXVWxUb@bkn'],
                    'encodeOffsets': [[
                            109812,
                            30961
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500112',
                'properties': {
                    'name': '渝北区',
                    'cp': [
                        106.7212,
                        29.8499
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@bVVXLa@lnbWn@L@XVlK@VVLUVlbkLUKVVVL@VnXVL@VV@UbVb@x@¦UxVb@bUJL@LVVxlK@nk@U@WUVLlKXV@VblU@UUKVU@wn@VJVanLlkX@VaVK¯@a@U@U@VaUKkUU±maUkm@UUkbm@@Vk@@JwU@Ub@I@JmwUL@a@@KkVÇLkWk@kUU@@xUVmKUnllUb'],
                    'encodeOffsets': [[
                            109013,
                            30381
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500115',
                'properties': {
                    'name': '长寿区',
                    'cp': [
                        107.1606,
                        29.9762
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VVUbXlX¥l@XnVmlxUx@@blVnnôĀlm@aVaXwWUnmUwW@@UkKlwUXmImL@KÆ°na@UUImyU@@yULUUm@@mU@VIkaW@UUV@KI@mmUw@mKUnUUIlVLUb@@V@V@b°ULUbW@klmKUbUIm@@xUVVL'],
                    'encodeOffsets': [[
                            109429,
                            30747
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500225',
                'properties': {
                    'name': '大足县',
                    'cp': [
                        105.7544,
                        29.6136
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XUmaVaUU@anVlKXbValU@aV@@IXK@@bV@VxVK@UXLlUJXa@_@@aVKÅWVkwWawUa@am@kUWLU@kWmX@ykI@W@UV@na@LlLV@UkwWUKmXX`mIVl@bXLWVkbkkx@`VXm@@J@U@UUKUxk@WbUIVl@VXLWJUkUlUImxXlmb@X@VUJUnVbW@UV@@VVX@bnW@LVxUnlJUV@n@VxVIn@l`UVVVL'],
                    'encodeOffsets': [[
                            108270,
                            30578
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500224',
                'properties': {
                    'name': '铜梁县',
                    'cp': [
                        106.0291,
                        29.8059
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VblLV¤nI@bnKVV@Ul@@KVI@UnJ@LlklVLkxWK@bXb@Vbk@Vb@ll@@nVlnIlmXblaXl@W@_Ü@UUalU@aXL@VlabaVL@mUL@UUÇXUWX_WaU»m_@UWULWb@UUVmK@VU@UImK@V@bkLxXblxXUÆUL@b@@`WbIkVWK@VULUwU@@a@WL@JU@@bkVUb'],
                    'encodeOffsets': [[
                            108316,
                            30527
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500226',
                'properties': {
                    'name': '荣昌县',
                    'cp': [
                        105.5127,
                        29.4708
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VI@U@WnaWknwVJVkVlIXWK@UUkVJXal@VwVL@V@V@In@UW@_wlllaXUWK@aUknJW_Û@aWaU@@UVmUUaUImJVnÅUmVUm`kUUVWLnVU@VVmXK@nxmULkxImJ@nU`@X@Vkn@`@nlV@nVJVaXVLnK@bVV@nV@lbXW@'],
                    'encodeOffsets': [[
                            108012,
                            30392
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500227',
                'properties': {
                    'name': '璧山县',
                    'cp': [
                        106.2048,
                        29.5807
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XzVlVVkbVL@JVĀX¼VXbW`XWVÈVVVkV@@UXa@alK@IU@UKWUyUI@wVUUWVak@VUkW¹@WXI@yVIUK@kWwkÑ¯±W@kUb@KkVVVmXJ'],
                    'encodeOffsets': [[
                            108585,
                            30032
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500109',
                'properties': {
                    'name': '北碚区',
                    'cp': [
                        106.5674,
                        29.8883
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XVLV@@JkL@bWb@VU@UlÆVya@nV@nn@KU@IVJU_lJXV@VlVIV`nIn°@blUbKVI@aUaVw@¥@wUaVaU@@UUKWm@UUKUUVLlKkaVUUK@UkLWU@@KXmma@kbWKUU@aUamLnÞ@VWLk@@Wm@ULU@@UKUVWI'],
                    'encodeOffsets': [[
                            108855,
                            30449
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500110',
                'properties': {
                    'name': '万盛区',
                    'cp': [
                        106.908,
                        28.9325
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VIV@@wVJ@InKVxXal@@U@U@KlUnwUW@kVUKUmVkUa@I@KW@@bk@@mU@m@k@a@aIUxmJk@wULwkKmVVX@VXV@xVLVVULmWXwWUU@@nUJVL@KV@UVULlxnL@VnUl¼@l@XVxVVUbn@WbkxUlVnU@m'],
                    'encodeOffsets': [[
                            109452,
                            29779
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500107',
                'properties': {
                    'name': '九龙坡区',
                    'cp': [
                        106.3586,
                        29.4049
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XKL@V@XbV@lW@UV@@VXIV@UVKlL@KnnJ@VV@VU@I@@mVUVWUUmL@V¯LUK@UV@UU@a@U@yU@WLUK@X@KUVmL@@aXI@w@ammVk@WÛwm@UxVVVbVLUJVxVUV@V@X@JUIVbm@@Vk@@VkL@lVLUJ@zWJ@X'],
                    'encodeOffsets': [[
                            108799,
                            30241
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500106',
                'properties': {
                    'name': '沙坪坝区',
                    'cp': [
                        106.3696,
                        29.6191
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XºlUVl@UbVXUV@xVJVzXJVUL@VV@VKn@@Xl@XK@UmÝnKVbVakkVm@kUK@UmIm@LkKULVU@WJ@UU@@VkXU@Wa@@UKWL'],
                    'encodeOffsets': [[
                            108799,
                            30241
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500108',
                'properties': {
                    'name': '南岸区',
                    'cp': [
                        106.6663,
                        29.5367
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VVJVL@bUVVnl`XIlwXJlw°nnlIXW@UÇĉk@WJkwkL@WVkU@LU@U`W@UXUV@n'],
                    'encodeOffsets': [[
                            109092,
                            30241
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500105',
                'properties': {
                    'name': '江北区',
                    'cp': [
                        106.8311,
                        29.6191
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nLVU@wV@lV@XllÈKlU@L@@bVKnx@I@JVaV@x@Il@@Un@laVVn@mkUIm`k@WXJmk¯mkxWIkxWJk_UmVUUK@UU@@l'],
                    'encodeOffsets': [[
                            109013,
                            30319
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500104',
                'properties': {
                    'name': '大渡口区',
                    'cp': [
                        106.4905,
                        29.4214
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@k@@U@w¥WKkVkImUmwa@b@xWJ@b@nKVU@L@WVLXKV@@z@V@bVVU@@VVL°K@U'],
                    'encodeOffsets': [[
                            109080,
                            30190
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500111',
                'properties': {
                    'name': '双桥区',
                    'cp': [
                        105.7874,
                        29.4928
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WwUwU@kK@KmbU@@V@XlJ@znWlXV@XK'],
                    'encodeOffsets': [[
                            108372,
                            30235
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '500103',
                'properties': {
                    'name': '渝中区',
                    'cp': [
                        106.5344,
                        29.5477
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VL@VV@VL@aUKIUU@@JUVU@'],
                    'encodeOffsets': [[
                            109036,
                            30257
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/fu_jian_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3507',
                'properties': {
                    'name': '南平市',
                    'cp': [
                        118.136,
                        27.2845
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@knyk@KU¥wV@nkWzUmk@@lKUa@aVI@UKUamKUUVaUI@X@UV@K±IUVVlUbUbUL@KWUXmWk@KkXmmkÅKUa@amUbkUkKWUnwUÇwVUUÝUKV£U@nKWwXLVKm¥@wUXkmWk@@wX@lU@yVImaXwV@knU@mbk@mlUXmU@mV@n@bnW@bUIWJImVUKWbUK@nkKaU@W_VUUmWmL@UU@bUWUL@V@bmVUz@`mUUVVbXL@VL@lmLUxmVamXkW@xWbUVbUxkU±@ÅUmmkLUbW@@`kLknVlV@lbXxlVUXVVUU@UbWkIWVUUUJkI@llbUxVL@VVUU°ULUmWXUV@VULWb@xm@UaVLVKUa@w@VbkmVambUUm@@VkK@@bxlxX@n¤@X@@lkLWV@nVkb@bWJXLWx@nkxmmbXn@VWVUn@VnJ@bVXl@VJXnWbX`lLUlJVI@@VXV@Vl@bn@@Æmn@VxXU@mVIlxVnIl@nVJaXI@mlU@aXkVm°klmnVV_na°@V@xÜ¦XKVnnUlVXbVKLXKV@naV@@VVl@@lXblXWnLlbVK²n@@VLUnlV@lXxô°V@UnaUUlKXLVUVVUbVVlUnJVX@VW@an@lb@nl@VU@anUVW@kaUm@InVVKVU@kUW@Uam@km@kVa@a@nwU@WlI@mVI@WXaW_n@nlkkW@U¥@kV@Uw@wU@@IXK¥VIn@nU@`@Xl@VVLnaWbVaUwnU@VIKlV'],
                    'encodeOffsets': [[
                            122119,
                            28086
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3504',
                'properties': {
                    'name': '三明市',
                    'cp': [
                        117.5317,
                        26.3013
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lL@Un@VVnabnUla@Ux@VbULUKVbn@w@XaVK@UVUXWVnVKV¯VU@UUKVwka@klJVIVVXUlJXVaV@VUUVWkUWwkaU@UklmlK@_X@ValKnnÆV²@lVVwUaVXa@wlXnWbnUVwnK@kK@UWKUaVUnV@_VynU@a@UVKVXaV@@VnKnXVVUX`V@blL@mVLXaVLnUJXIVJ@amX@a@mnUV@nVWnkl@naV@ml@@KmKUam@UU@@UlKUVkUK@aVaUwVU¥UIkJ@wmI@mbkwkVW@UXKULU`IVKUa@LkkVmUU@WlULUWÅU@I@WWnU@@w@a@Uam_XyVIVWkk@mwVKXUV@nwVXkWÅU@aU¯KUnK@¯mULXVLnWVbVbUVm@Ub¯¼W@am`kbamLUUUaUXV`@x@XmJ@n@L@xkJUU@kU@mWm@kUUwUUVWl@VUkIy@kkaVUUmIWVXbWxU@kmVkK@nWVX¦WxU@@bkx@VU@Wk@kUbmJUUmkUW@_kKWK@knV¤kIUKWLUbV@Wbk@@VWL@VkI@lUXVxUVU@@mWIV@a¯nUaaUV@Jb@bÞ°VbU@XaUVmL@VXblnV°n@Vnx@VUUUlK@InJVb@Vlnn@VL@VWJUx@XlJUVVVl@LUUUJ@L@lUL°¦kVVnV@xVl@blLnlLVaXll@nVUn@xn@nml°X@lb'],
                    'encodeOffsets': [[
                            119858,
                            27754
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3508',
                'properties': {
                    'name': '龙岩市',
                    'cp': [
                        116.8066,
                        25.2026
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@aI@VUbVb°m@bUXJ@nV@VUUwVW@klJ@UXK@Ul@Xa@UVaXKVLlJU£lm@XLlL@`VXnlVVnIVall@XV@@Ulw@aV@XwW¥XU@mlLnUlV@XwWaXUJVnUVlb@lzlJUVk@UXVVVxlVn@nXV@@lVVlI@w@K@mnI@W@wU_VWbVVVnKbla_nbX@°»Van@VUUaUamXUKWK@a@Uk@wWkXWW@wUUKw@_lywUkU@@U@kamVmXaUVUka@Wk@»UUUVKkbWUVUbk@mkxkKnIVUmW@kUKmXUmVaU@kU@m@KUWVkIWJ@U@UI@wUUUa@KW»nU@mVkUmm@XwWU@UUmL@w@mnVUU@aWak@@amxU@UxULWVXbVLU`mbUImVUbnV@@bVn@bnVWxLmyUbIUK@aVmakbVUXWUlKWbkV@WLUlk@@nbb@lkKmU@UIWJkw¯UUVVxm@@XkbWxXKlUzWJkUUL@bmKkV@@VUIUlWV@XK@VkbWx°xUb@LUbk@@VWb@LXJ@VWXU@@bUVVVVn@VVlLn@l@xk¦Vx@bVJXbn@JlnXxV@@nJ@X@V@lmxbUn@xVL@VVKlL@lnLVaVL@xkl@LxVl°XWVXVlJWnxlJ'],
                    'encodeOffsets': [[
                            119194,
                            26657
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3509',
                'properties': {
                    'name': '宁德市',
                    'cp': [
                        119.6521,
                        26.9824
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@LVKVaVaUkVU²J@LVU@@WVJUbVVnLVbL@VUJ@bVbkL@l@VnyXmlU@xV¦L@lmz@lnL@bVVbVb@lnKVkVl¤@zXV@l@XJVLVKnXVKVnU@wUm@KU@UlVlw@U@U@UaUKlU@kXKlmXIWKXaVIVUVK@KU@@kJVUnLVJUL@VIVa@VnLKUnl`VbVV@Vbn@Vzn@lKnVlIVVKUalkXJl@XXVWVLVUUmVU@Unm£lK@Uk@WUXK@U@WVwVkĠkĢÇ°aUÅUwmaţɱUÇaw±V¹XalKôx@UVaÜʓͿVóbÅLJm¯Vk¦k@mamXkKUULakbk@mV@LkJWb@VkmXk@UVmaUV@amLUKUamI@KUaU@WbU@UUUUIWJUkm@wKkVJm@kxÇVUK@mUVUkmlkkVm@amwLVWU@UbVLkUb@VmK@XaVWU_VJnwV@@kUmWakx@kwWakIWxnbUJz@kVW@@x@XllnVW@xn¦ULWKXxmL@VU¤VLÞVVUÈxVmxXVlLlVanV@bbVLlÆnnlW@LXlWnXV'],
                    'encodeOffsets': [[
                            121816,
                            27816
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3501',
                'properties': {
                    'name': '福州市',
                    'cp': [
                        119.4543,
                        25.9222
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lxna@nJ@xlIVJV¦UVxUb@bLVUlVkL@V@VVn@VbLn@LUlJXblx@lwXbVn@lU@mxUIV`UXWb@nLU@ValUKVaV@UXKnxbn@lUkllnUVnV@VLUÈlwn@UIlLxn@VlXIVJVVVV@XaV@Vb@LnJVbVLnK@bVUnbVUl@nWl@UXalI@KnUl@labVKVlLnWnbl@l¥°UnIÆKôa΀Ua@UUwÇWǓIUWUÅVkƨm@@£@KmLU¤ULˣJkUVǟUUķ@ĉVKUk@Ñ°wôÇç@īé@Åţ¥mīÛkm¼Å@VķVó°ō¦U°n@bVJXVVL@bUakLmx@xmxXzW`XbWnXV@bWLÛ@a@aXbWVkaÝwU@mlWKkLWWkLUKULW@kVmVUUÝUamV¤n@xUVUzkJV¦lJU'],
                    'encodeOffsets': [[
                            121253,
                            26511
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3506',
                'properties': {
                    'name': '漳州市',
                    'cp': [
                        117.5757,
                        24.3732
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@bl@Xb@bVVUm@nx@nKVV@XVWxn@VnUl@nmVX¼@LVbVV@xVJV@@XIlJXUV@Ln@lVV@UbVnnWVL@lnXUVmJLlwnll@VaUXVlaLVUVV@¼Xl@lbUVVWbnnUlb@@VV@aVUmlUaUny@kU@Wkk@WaUVk@@ammk@@U@UlU@aUa@wl@mXLllnLU@anVnU@L@VVV@KlXnWVnVanUw@w@wmnÅ@waUam@UkmUl@@aa@U@¥kôKwÈ¯°w@ŻkwǕaKÑÛk@ĕōřċ£ĵUKW»kÅŻLU@Ulġw@¤VzVUbkKUbmLmlULU¼UxmbXl@bWVb@bUnVUVbULU@@VkbVL@`U@WX@XV@b°@b¯@¤@Xm@@b@`UVVUL'],
                    'encodeOffsets': [[
                            119712,
                            24953
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3505',
                'properties': {
                    'name': '泉州市',
                    'cp': [
                        118.3228,
                        25.1147
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vlxkz@`xLVV@xXXWXl@xl@V@bnV°@LVm°LVbV@ÆXWlUmxU@WVULnx@llUXUJWzn`Vb@@b@xV@mXX@@JÆVVXVKXkV@nVlUl@KVbULJV_VKLVWX@lUVkIU¥lIVyVU@wm£nUVWU@am@UmWw@UX@@amVUn@@aUUlUVanaWUXWmUnkK@VUlVVUUw@XLWWXma@knmbVbVXbVL@XJlInlLwmXów@çV»ÇçŋaķƧóƅóKġ°nÅUķƑUÇW@¯xÇ°öÆlVn@lla@Lb`@VXVVx@V@bULVJUkÇ@¼XUKk@mmULkaWbk@x@UkL@a@K@U@UmKmbU@kV@UmVUbUmmXkW@LUU@U@KmVmU@bVmKkkWKnk@@xVb@bkV@V@Vl@nn@bl@VUXbl@XlV@@lmzVVbknUVb'],
                    'encodeOffsets': [[
                            120398,
                            25797
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3503',
                'properties': {
                    'name': '莆田市',
                    'cp': [
                        119.0918,
                        25.3455
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VbÞVVnUlUX@VKVLlKXXlKXLnkV@ÞxlbXUWab@bÜ@XK@aWUXmWaX_Wynw@wnwlKbV@aUKWUUI@amV¯Ŏ¥ô¯ĸUUÆ@n»¯aƿé@ţ¯nĉĬÝKóó@ÑU¼@èxWônxKmkkJWI@UKWaUUaamn@lnbWXXWK@VxUVkUV@ULmlnVWXXVmbUbkVVV@bm@UVn@bW@@VXxn@Vn@bVUX'],
                    'encodeOffsets': [[
                            121388,
                            26264
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3502',
                'properties': {
                    'name': '厦门市',
                    'cp': [
                        118.1689,
                        24.6478
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VlUV@nanL@V@V@L@blK@Vwl@XalbVKnnl@VLW»È@lVUIVK@a@UUwWUU@_aK@bkkm@UkõÅxóLl@¦@Vb@bk@VnVln@Vbb@xmÆn@x@xx'],
                    'encodeOffsets': [[
                            120747,
                            25465
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/gan_su_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '6209',
                'properties': {
                    'name': '酒泉市',
                    'cp': [
                        96.2622,
                        40.4517
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÇnÅaĉ@U¯¥UŹ£WUýUU±JkkUwyÞIČxĊĕĊ¯¥ÆUkţUÅÓ±¼IUx¯UÒƑÝÅ°KÝnğ°ÅU@@Vn@þ¼¯WnŎ°XLWlnVnbWnVXxmbabóUlǕUUaIUmlU¥k¥ĉwkkÝɛa@¯U¯°mVkVnKlōÑÇÑU@klUġkUŻnUW@¯k»mWV£UKnUmUww@UIVaXwm»Èmmwn¯ċ¯LĉUJUalka±Va@Uk@ÛÑ¯WmnUaɝ¤Ûmn¯m±x@wóxÛLġÒUx¯VÈJUbózÝÇKĉ¯ōlÝUÅWl¯nťbÝ@¯ǩLġmV@Æ¯ĢkÆmĊkVťLɃmÝXó°@ĢbVóVÝ¦ɱ@ƧaġUVĠÇÈV¼UVţwmbJÇwˋaXmÇ¯KkkmbXm¼V¼ǬŚ²¤ôŰÆƴô̐ŤǪnɆӨ¼ɆLÆłUĊxŎƞȘǔˎǬǪnƨŮǬö°»ġÞÜÆĸÒĊǀbƾèôÈ@¼¯þŤĸƧ°VĀ¯b@lÈĊʠń̐ȘKǀֲॗţÿǕý@ʊǓƨóÆÑǖŃôw@΋ʈƆÅÈVVĊVóĊÅ@ÞƒĬV@Þī@°V@ĸĢ°XτƜĠ@ÈaÜ¥ŐƅnğóĕVġUůƿŋĕa±VUťÇğÑ'],
                    'encodeOffsets': [[
                            101892,
                            40821
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6207',
                'properties': {
                    'name': '张掖市',
                    'cp': [
                        99.7998,
                        38.7433
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÈÒŎÒkmLUlU¯nV°@°ɜbÞĠaÈ»ĸlLVUÈ@Ċ@ýUm@@ÆVĠ¯ÞmLÆ¯ÞƒÑ°VVwJ²»ÆÔVlŤÅV¦ĉ°ĉĖċwÝJzVxll²IVVVþX¤źV°¦VĊ@ÆbÈmǔLĸĠ¯Ģaô¯ĸmÆÛUlÇĸk°XyĊUǔVǩnmV»a@ýnK°n@l¥@»żĊ¤mç@£ČU@mmVkÞUƐ±²¹°ĠwÅƑŃU¯V¯aÈŁÇ»ġn_°xŎKlxklx@Þw@Æm²bÇ²LlkWXať¯ĊaÑK±w@wUÅçV±Uk@@¯¯xU±±UU°ōxVxÅÔō°ó¯UÝ¦óbÝþ@ĉÈóUVUx@VUVÝwÅÈÇóVkk¯JÇkmmL@KÇx@bk@U°ķ²ó`mn¯°UwlÅkU`¦ɛôķz@ÅnÇ°U¼¯KmVk²J¼ƏÞķô¤UL@mnğ`ÇnUxÇ@ÛÿU@kŻ@x@móJkÅ¥VŹĉóÒĉlċ°ķUƽÜ@x'],
                    'encodeOffsets': [[
                            99720,
                            40090
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6230',
                'properties': {
                    'name': '甘南藏族自治州',
                    'cp': [
                        102.9199,
                        34.6893
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÞnKlnwX¥WÝXkxÞUn°aĊVnUUKlÞĶWXnĠ¥ô»@nmVL@¤°VzJanU@aÆwna@kU¯yX_aĉbwéXkWwÅa¯V¥m¯UI@@mb°aÈçU¥@»knwɜƇ°I°ÑÈmVU¯Xa@wW@wV¯Č¥l¯Uwnm@kaUaóKkk@Çab@ÒWa¯IÇxÛam¼VUxÒl@zÝÒ¯bÝaĉVĉwÇWzJmJn²mÜ¯U¯ĉ@ġ¤Åb@²nml@@ULVxVU¼Ålmab@°l@WIU¯@m@ó@UzţyXÇUÇVUUVLkbWakVWmUbkkKUÆ»n°Knk@aUVmnk»l¯Ģlw@_kKVU@na@lUk@¯¥mV@kmbWb¯Åõa@mkU@kÇkU@`@óóbl¼Uxn¼lVÈx@blVkVVn`XÈġÈ@ÇK£ÝJmUUnUĖmlUmKUnVÅaUwUĉ`¯n¯wW¼nxV@bĉnkIċŘkXU±ÒxÈ@X°`lVIÈ¯ĊVVVan@VaUVażVmblkÈWWIXaalL@wVbV¦lL@lĠnÒUnkL@ÆÞkÞKbñþW¦ÛċVULUºkÈlŎUxÆxÞUUxÒx@XbL@lÆ@ÒlXVln@bm¼J@Ånx@bnĠmxVXmbÈè@Ċ£ČWw'],
                    'encodeOffsets': [[
                            105210,
                            36349
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6206',
                'properties': {
                    'name': '武威市',
                    'cp': [
                        103.0188,
                        38.1061
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@±¯¥@klwU»ÞÝmwKm¯ç@kVÇUL¯lVUKġġm@a@U@X£°l°LŎÇ@aōVÝwÔKUÅWJ¯lm@ÛVWa@klĉUmaLUanak¯J±KkXóÜÅx²Ç@nUÒĊb°@ÆkLXÇÆ@xÝnxWxţ¯¤I@ÆnVVVlU²ÆèV@x²xLÒĉbŦ°WbXklÞ@l¤XĊ`wl@ĢÈŎm@bnVUb@ÈÆÛLèÇUÒÅ¦lĸ`°ĮʟÆǓbĉôϚĊÆĢnŤé΀ÑĸĀĊ¦@@l°l¦Ȯ¦ɆÞĊKŤĵĸů»mŁyġķŭ@Çɱȭ¯mƧUĊķnŁŻ»UaUƛɞÝƨů'],
                    'encodeOffsets': [[
                            106336,
                            38543
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6212',
                'properties': {
                    'name': '陇南市',
                    'cp': [
                        105.304,
                        33.5632
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÈÞ@l`UmV¼@nnÆwVlnVVaLVÈ_ÿÞ@naxÆ@l_@VxnK@llLnxmÈŎJnbUxI°l@n¦lÈIlmX¥k°@kJk²é@klaUaVaU@@ÝnIWnmnxkºÞaV°V@nwKxôbÞ£VUbþLn»mVwIJ°@nb@°°IġUkÇKV@Å¯»lLnm£@anK@ÑÜn@»mL@£ykUUmbUÞÝ@kyÇbó»XUxWVzb±mÝbXawUamL¯»@wUKVwm¯ĵJ°ÅUWVkKVk°wÈVVÑlU¥kmVamknUw¯¯bċ¥ÅKkKkVċVk£kKVwÑa@kóyÛ¯ÇVkówXō¥Ç¼ów¯U±k@xIĉÒÅVmÈnÜ@n°bUbÝVUnnJ¯Į@m¦nVÜ@L°JXbÑ@aÈb@llôLVbb@lmnVxk°ċ¦U°@xX@xWb°UVÇn¯Ò¯Jɛƈmxl@¼'],
                    'encodeOffsets': [[
                            106527,
                            34943
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6210',
                'properties': {
                    'name': '庆阳市',
                    'cp': [
                        107.5342,
                        36.2
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kwĉ»VamV¯wIóVkl¯KmVō¯ÝWkL@bÝKō¦@@Lx@b@la@km@@l¯nm@UaÅ@óWUXm¥nw`@UUxķôÇ°ğ¦@VJ_nIVnalxkXJWn¯nVLxl¤nnVbklVX@xnxmV@bUK@nm@@xV°±aÅnkUWnUax@mn@¯LmUĀlU@lV@blLUblxklkIÇx¯°UXbaVUnV@°LUlnbX@`°nVmbnÆmVkLmK¦U@Xy@kl@U°K@¼XbW@bWnLVaVVz@xlVČ¥lbUxÞlVU@nÆWôn²VJlUƧLnmÜLXan@mw@wlUlV²mblwVÈlLÞ±@lVnUlxnkma@mkJ@kXVU@mn@¼VXUVlLnmVbôaVnWV»ÈUl°È¯ÆInÆU@kk»mKkÆġk¯@»mk¯@óÇlÇ@VykklUml¯Þ@w'],
                    'encodeOffsets': [[
                            111229,
                            36383
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6204',
                'properties': {
                    'name': '白银市',
                    'cp': [
                        104.8645,
                        36.5076
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VKUÈl@è°nLnxÝÞV¼kx@l¦²°ĊóĠĊ»@ÈxaĊxlwÈVŤa@¯²aÇ£Jk£lnUÞ@°ô@ywl»lIX¥Ǫnw@ÑÞWlaÅlL@Uwĉakl@¯mwna°JV¯nUVÓÞÑm£²óWaUÇ@óÝUçV»ÈkkW@¯xV@XlK@wX@Vmm_@wÈÝKU¯ÇwVwÅK¯VkJXkWVaIm¯UkÇlVĀV°mxók@¼óWxĉÜU@UbzÛJÇk@ÆnVlÔ@kxô@ĬWL¯K@aÛImm@IUa@UÇêU¤VÒÇx¯ÒVlk@Wbĉ¦UbkWV_y¯Laók@b@nmbkx°'],
                    'encodeOffsets': [[
                            106077,
                            37885
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6211',
                'properties': {
                    'name': '定西市',
                    'cp': [
                        104.5569,
                        35.0848
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@aV²wVJV_@LlanÅllŦçÜÓ_lnWaôkxUbmV@È°lènk°l¦`@nnL@ÈlÜIyVaV@ĊÛXwô@»lônwU¯ÿUÈkl°VnJUblXWIl°UV@aVVVmnL@lUUwmk£bV¥VUVwÛlaÇÝÞmk£LUy¯L@WlkKW_XaWmġU@akakXkmVwmŹVUbWónmwnWW£KÈnV¥¥Æ_klWbU¯V°aôbnaVwmaōInÇmwkK@kmLUw@`kÅ@wb@mÝĀÇ`UKUbmUUkÅxmm@»nUVk_Ý@Ç¦VÇè¯ban@@JV°nU¦°ÆbXxWlêxĊabW`zV°@lmbÅx@bmVbI`¦@ÒUVUI@ÆL@b¼@@lmxnL°ULÞğÞ°kLUL°xVnKVl@zX@'],
                    'encodeOffsets': [[
                            106122,
                            36794
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6205',
                'properties': {
                    'name': '天水市',
                    'cp': [
                        105.6445,
                        34.6289
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@UyÈVVUnn@VU`UblzJnk@VbKU°lwW°nkVUÈl£°V@n¥VklkU±Unlw¯UkwmKUlmkUmnkym@Å@UmWÈU°l°anlJkUKlU¯Èm@kmWV»kkÝLUWUx±b@¯ma@¯IJUxnm¼KýaVUÝ¤óawLmxU@¯UbÝ¹lmwmnXmJ@ÞV@UbVbkbl@±êlIl¯@lW¦knÇJkm¥k@¯Jmbóa¯bUV°akXlÅ`¦U¦ÇmLX¤mXnxmôXaVźUnUxlnlWbl@bĢVnXWbX`lLXk@°KVzKl¤nÞÝÈkbÜ'],
                    'encodeOffsets': [[
                            108180,
                            35984
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6201',
                'properties': {
                    'name': '兰州市',
                    'cp': [
                        103.5901,
                        36.3043
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@lW²L°IlmbVbKnbĊVlk@XbÜU@kn°XIÆVLÓÞxŎUlôb°KzU`lXVaĊ¥Xal@kU°ÑÈwUÑV£ÈéV@VbJ@nnÜJ@bL°XK@īówl@kÓmUÅmK@m_k¥l¯mkçÇ¯@nUaVwólXbmk`ÛÔťèkkmÆkbK@U`UI±xUbWlXmbVbÅÒólkIWJk@zKŻ¼@xUxó¯LWb@ÅÒ±¦U`nbťĀUVbLU'],
                        ['@@¯lwna@mōÈ¯K¯kW¤@@V@bĢnĢVLU°k']
                    ],
                    'encodeOffsets': [
                        [[
                                105188,
                                37649
                            ]],
                        [[
                                106077,
                                37885
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6208',
                'properties': {
                    'name': '平凉市',
                    'cp': [
                        107.0728,
                        35.321
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@ÆLUxÈxV°LÇÞ@xn`Ü@X@nĊÆwnJmwUxaUkw@V@waVmlLXÝl@XVĢmV°@nl@UUUWK@wÿVI²Òlm@nÝĊýVV@nJ°Ułm@kV¼nKĢÈ¤ôKblnKllVk²aĠ¥È¯ĸóVw@V_xmn¦VWôXÆ@Vbn@°m@kn@@lb@ka@wK@@UlKVaWXW²¹lÓw@_°n@@_lKÅķW@mLUWn»Û@l_Ç`Ûmm°ÅbWb@VWbUUKÇÅaġlmkUġl»LlUm¦@¯U¤ÇkVUml¯Xx¯kVLUa@mlIkyVa_UV@mmUVUÇVzUxUVU¦a¤lnVxVk@mKUnUU@bU',
                        '@@@ż@mlkġk'
                    ],
                    'encodeOffsets': [
                        [
                            107877,
                            36338
                        ],
                        [
                            108439,
                            36265
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6229',
                'properties': {
                    'name': '临夏回族自治州',
                    'cp': [
                        103.2715,
                        35.5737
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ż»Ly@lXIJlôkÆÑUanaWXkW@yk@ULmUw¯KVlK¯ĠÝÝVK¯mKnwk@@»@aK@ÅVJVU@Ñ¥_Uy¯@£UKmn@ó¼ğ¦WmĵXÝkVLmVĉU¯bmÝVwWlXÞW¦xkmmLÝ±U@VÞ@ÅÈW°XÜ¼ƨyUĮnWnXÝxUx°lVXJlôV'],
                    'encodeOffsets': [[
                            105548,
                            37075
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6203',
                'properties': {
                    'name': '金昌市',
                    'cp': [
                        102.074,
                        38.5126
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĢÈ¼Çł°bU°VƒńÆǖŰnÆōĬǔaʠÅ¯ĭ_kķÆ¥VÑÈçÜKÅ@ÇVaUm@aōnġÇk@xĉ_Wk£@Ý±KÈ±aÅn@Ýx@kwlkwōL¯wm`'],
                    'encodeOffsets': [[
                            103849,
                            38970
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6202',
                'properties': {
                    'name': '嘉峪关市',
                    'cp': [
                        98.1738,
                        39.8035
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@llĊx¦l¦kVVnJVbǖVkôVabnaWwUXmmamUXkWKō¯Xm°»ĉÇ@UVKķkÇ¼ğb'],
                    'encodeOffsets': [[
                            100182,
                            40664
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/guang_dong_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '4418',
                'properties': {
                    'name': '清远市',
                    'cp': [
                        112.9175,
                        24.3292
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lÇ¯kÿaV¯VaÈU¥ÆÇIlxmnbUxlUôl°kWl@ôVwUanUl@xVkaX¥kU»a¯±@kka@UwmUkwJk±k@L@ÝWUwVÝxÇU¯ÇX@mÅ@@yĉ£VmUwȗ»ÇUnlUnWU¯`Uk@@x@bÇxX¼VV¯LĀkÝL¯@VĀ¯lnĊW¦kVÇôkUÇUK@ţU@aóÜUU»@¦k@VxKVbn@Æl@xbWnlUlxÈlVÈ°Æ@¼@xWxŎVK°¥nÆkŎ@ÈÑmK@¥k@ô@nôV'],
                    'encodeOffsets': [[
                            115707,
                            25527
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4402',
                'properties': {
                    'name': '韶关市',
                    'cp': [
                        113.7964,
                        24.7028
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WXk±Ñ@UwmUwĉwlmn@Æwn£mkI¥ÇÅ@¥aón£nWWw£V`Þ@nVml@xô¼IV¥kUmkamUkVWwÛ»mó£UVÅKmn@x@kbmm¯aXkaVĉaUbÝ²lIlxnVVx@lb@l²°bV¼lW¦bUlwk@mVVbUxó@kX¯lókVkwVmankwJÅÈ¦ÇVUbU°blĀ°kÈ@x¦ÆÜ°@°¦óaVUôlUlbXl@nÜVnKlnIVÞ°W°U@bnm@¥IV²Ul°VnalzXyl_Vyƒ¦lLlx@ÞbKmknVWanwÑVwČº@n_ÞVaVÜIl@KÈVJ@a£È@@kmaV¯W@_a¯KmbkÇkLmw@Å¥'],
                    'encodeOffsets': [[
                            117147,
                            25549
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4408',
                'properties': {
                    'name': '湛江市',
                    'cp': [
                        110.3577,
                        20.9894
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@kX@aUUċlkJk@wVJXUWk°W@nKnwlUl²blU@lIl@XbWxnm@lW@wwUJX¯VU°`ŎóˋkÝÝkÅ@ÇmğÈřmwaĵVxUÛ»°ĠǷnýmóX¥ɅĵҏÇ@°²ĊUĖ±ĮU¤Ç°Ā¯ɐnżUĊĊĬV@è@ÔÒU¼l¤nĠbêVĠ°ÈyzVaVnUÆLabVlwÆ@'],
                    'encodeOffsets': [[
                            113040,
                            22416
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4414',
                'properties': {
                    'name': '梅州市',
                    'cp': [
                        116.1255,
                        24.1534
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nÔlW¼x¦@lVllLkèa@z¤Ė¼UxlnUKUbÝlU¼lb@VxVklJÈwV¯@ĠlÛĖnbkÆźÞUÈôklmL¥LWnKUkVa°Vx@IVV@x°bUkaa@mV@@ywLÑUwVUVUbÞVVann@XwÇÿ¯²aVamkXaÆ»@»nw@¥UXakbWa¯KUw@¥m@kwmLU»UUJ@kmU@UUWU@yanwmçÛl¯¯UmKUmwVkmÝXbW@XWÝbk¯@±w@»U@W¯Å@Ç¥UU@IUakJĀê°þXkam@_J°m@X'],
                    'encodeOffsets': [[
                            118125,
                            24419
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4416',
                'properties': {
                    'name': '河源市',
                    'cp': [
                        114.917,
                        23.9722
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°VlmX¹laĢÒlm@V£@¦Ģklynn¼lW°zW°VbÈV@lÆbnnJkXVÆaÅW@UUw@kaV»ÞkVaVLkmVw»ĕ£@yblçkKkU@k¥wX»kmÓ@Wn¯I`@nlbWý¯éÿlI@XUmWUw@@UJUÇmKUV@xţk¯¯LWnUxK@Å±»Vwa¯@¤WX@Û¦@¤ÇIÈ¼WxX@WxwUnVbÅèmVa±²UWl@klÈ¤nôÜ¼XxlUnVlbVnlU¦Jó»@wnkmUÝ@U_¤XxmXm¤ôb@¦ÈÆ¦lJn'],
                    'encodeOffsets': [[
                            117057,
                            25167
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4412',
                'properties': {
                    'name': '肇庆市',
                    'cp': [
                        112.1265,
                        23.5822
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l@¥@V¼VôÛ@bV@ŤVLÈlVÈólUX¥mĉ°kÿU°@ÞKlÿ°KUUW»Èw@aw@@nm@w£kÓVUVnKk¥£Vam@nkKkbÆǫmakmLU¥UmÛwmVUmUJÇaUxÇIn`mb@Þ¯b@nJ@nlUVlVULW¯Û`Ç_¯`m¯IbĉWċzx±Jx¯ÆU_k@J@UmbXôlLn¦@¼ĊxlUXxUbLĠUnVĊwlUb@lWXm²@ÞWxXUnb'],
                    'encodeOffsets': [[
                            114627,
                            24818
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4413',
                'properties': {
                    'name': '惠州市',
                    'cp': [
                        114.6204,
                        23.1647
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lbW°bnnla@@wnmÆLVUkÇl@XkV²±bnUÆçUaVmxXw@WXwÇ»ÈJ@£Ü¥@XW@£°bUx²¼@ÆLVwmX°K°Ťl@wVUnLÈVVIky±wkKU¯ÅkXġÑÛlwUwlm@mnKWaÅm¯óÇmğb¯alĉUwķbmb@lÞÒVnmĀŹ@VbVUnmakLm`@xĉkklVÔVJVnlVUnmJmaLUblzmkLaō@@zV¦UV²kJnÜU@VXUL@lJL@bÝ¤UnVb@xVnlK²Vx°VxlIlkVl²k¤@n'],
                    'encodeOffsets': [[
                            116776,
                            24492
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4409',
                'properties': {
                    'name': '茂名市',
                    'cp': [
                        111.0059,
                        22.0221
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@LnÇlkKnkÆLUmÈxlUJló°n@ana@@X_@mÝóóU@aaU¯mL¯kV¯ÇVwkw@V±Ŏ£@@alw±Vk@mÅm¯ÿÅƧIÇ`ōô¯_UVW°IVx@xkX@mnwXWa@kkJ@kVa±kkVmxmL@¯XXlWVUI@xlIklVČV@blW@@nUxVblVxkôlxnynIÆ»Æ°aXwlKbVnXbL¤kLèVV¼²IlĠVXynz°KVx°@VlLlblK'],
                    'encodeOffsets': [[
                            113761,
                            23237
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4407',
                'properties': {
                    'name': '江门市',
                    'cp': [
                        112.6318,
                        22.1484
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lUXx°JWnnÆXVWX@ºVLV¯nUVnbôxaXmWXIUb°xlKl¯KxXÞ°XÈ¥Ü@ĉÞUç»nóVmax¯UÅU¥Ý¯@ç@ș@çĉÅUmUç±ĉKÝxÝ_ÅJk¯»ó¯nmèkǀWx¼mnUÜġ°@¦@xLkÇaVnUxVVlnIlbnÆÆKX¦'],
                    'encodeOffsets': [[
                            114852,
                            22928
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4417',
                'properties': {
                    'name': '阳江市',
                    'cp': [
                        111.8298,
                        22.0715
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°nKV°b@bôVÞô@nVlÒôÆUnlnn@lmkmVkaÈkÆÆk¥ÅÞ»ÆKXkW¥ÅLmÅkamJUkUVwUmÈblKw@@¥Ģ¯VÛnm»Xwlƿ@kbWaʵ@óLl¯ƽ@Ln°Æ@nUl²kxb@@ō¤U²@lxUxÈU°l'],
                    'encodeOffsets': [[
                            114053,
                            22782
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4453',
                'properties': {
                    'name': '云浮市',
                    'cp': [
                        111.7859,
                        22.8516
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VIl@`V°Åw²IwČyĊXa°Jn°_È`Ü_°XKVkUUVk@mmI@°a@Ýnam_ÈJVwlĉX@lUómaUmVU°UK¹@WXUWmÅXm¯IWwkVWlÅLÝ¼Æl¦ÅÅÇlbUllnknm@kmVmóÅkÑUW`@@bmb@¯mkôIkVÇwnVÅKmlLklmÈKVĊK°²`n¤nUbWlxVxLUx@°nXm`VklVxmnnx'],
                    'encodeOffsets': [[
                            114053,
                            23873
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4401',
                'properties': {
                    'name': '广州市',
                    'cp': [
                        113.5107,
                        23.2196
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ș¼VxUnĊ¤@z@Æ@nÈW°ÈVwUÞVxÞX@Kl@ÞVaĊbU@ml£k±lUkkJw¯UUw±kLUm@waUVmÞ£@aKkI@KVUW@ÛVmlIU±VU¥@yğzƧÇƽĠřÅnī±m@²¯l°@nÝÆóUll@XnÝVU¦mVV°V¼Jnb@°mbn@²¯¯wVw@@nmxX¤¯L@VLUm@@l'],
                    'encodeOffsets': [[
                            115673,
                            24019
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4415',
                'properties': {
                    'name': '汕尾市',
                    'cp': [
                        115.5762,
                        23.0438
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@@VxnXWV@bVJV@ÞÅU¥Ċx£UWUwÅUU¥WVUkĊÇnkV`°LVwnU@lbĊ¯Vnal@@çkUÝ¥ġaó¯ÅaÅLŻÆUýmy¯ó@ĉÆóȯwÆXbmL@nknVxkxÜĢÒWÆlV°Ll²xlz'],
                    'encodeOffsets': [[
                            118193,
                            23806
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4452',
                'properties': {
                    'name': '揭阳市',
                    'cp': [
                        116.1255,
                        23.313
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VÈ¦Æ@X°V@@¼x²°@lÞaWXX@aÞWlnUxVnnL°V@kmĢl@ak@mlk°aX±nwm±²¯JV²@wW_maV»U@m¯ĉUÑJlabVnlĸLlƅÛÇ±wÝ@ĉxó@è@kmbUĉ°ka@mVxU¯KU_mlĉÈVlXUV¦ÆVxVVX¤ĉwV¦ÝÆ'],
                    'encodeOffsets': [[
                            118384,
                            24036
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4404',
                'properties': {
                    'name': '珠海市',
                    'cp': [
                        113.7305,
                        22.1155
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@è@Þ°V¦VÆ°wnbUÆ»nçÆ@nxÜ¤²llU°VnÈJÞ°UôéķUklô£VVˌKÞV°£n¥£ȗÝy¯¯mÅkw¯bÇĔğ@Ýn¯ĊVğōŁŻķJ@Ț',
                        '@@X¯kmèVbnJ'
                    ],
                    'encodeOffsets': [
                        [
                            115774,
                            22602
                        ],
                        [
                            116325,
                            22697
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '4406',
                'properties': {
                    'name': '佛山市',
                    'cp': [
                        112.8955,
                        23.1097
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÈbInVVnUÜxnVV¦nKlnbÅǬlalL@mnUb¤l¦LUmUVlÔ¤@xmnVl°_XVVmkVmÈ@kn@VUK@°KW£nw@m@Ux°x°@±mna@¯amIU»U¯nUV¥ÞUWmk@Vk¯UknÑWÝĊÛ@Ç¦W¯WÝwLk°kL¯wVaWJXWnbwkVW@kĊ'],
                    'encodeOffsets': [[
                            115088,
                            23316
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4451',
                'properties': {
                    'name': '潮州市',
                    'cp': [
                        116.7847,
                        23.8293
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°Üknèmxbz@VVX@VnV@lIVVV¼nKlxn@@¦Vx°LXblaWbV°£¯W@nW@aUñVwW»@¥ŤÅUÝǓÝóV@ńÇkUVmIUwÅVWÇX¹@W¯bkl@nlb@kġn@l'],
                    'encodeOffsets': [[
                            119161,
                            24306
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4405',
                'properties': {
                    'name': '汕头市',
                    'cp': [
                        117.1692,
                        23.3405
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@U±°I±n²mx²@WºXÈÆUVxJUnlVÈ@ŃôUǔÞVçn»VyĢÛVm@»kaÝUÇ¼óÛÈķKċ¥X¥Wwğk¯@wķKkUmabkIVÒ°Ċ@nVU¼bn`Xx'],
                    'encodeOffsets': [[
                            119251,
                            24059
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4403',
                'properties': {
                    'name': '深圳市',
                    'cp': [
                        114.5435,
                        22.5439
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÞL@xbVVK°X°Kô¥Vw@anUèlkĊl@wn_lKnbVmUaUź@nÿUmÝÑ¯Ubk@ÆkxŻ@aÇXwJ¯LķÝUĕóĸóêWº@b²nmĬÆ'],
                    'encodeOffsets': [[
                            116404,
                            23265
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4419',
                'properties': {
                    'name': '东莞市',
                    'cp': [
                        113.8953,
                        22.901
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ŏ@blKnykVaKnbnIVmUkUmUIUÓçmV@bUxó¦¯LW¯LUUa@wÝKğŚƾƨÈĠy'],
                    'encodeOffsets': [[
                            116573,
                            23670
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4420',
                'properties': {
                    'name': '中山市',
                    'cp': [
                        113.4229,
                        22.478
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XÒlmV°ôÞÅ@m¯°k±@@aX¹¯VÝÇIUmV¯kk±Û£mw@ÅmèÅ¼mô¼èV'],
                    'encodeOffsets': [[
                            115887,
                            23209
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/guang_xi_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '4510',
                'properties': {
                    'name': '百色市',
                    'cp': [
                        106.6003,
                        23.9227
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lklWXL@VIl@XnJn@VUUalk@mK@kny@UlU@a°UU@VmaU@Ua@UWw@n@KmLm@alkmnIm@an@VIUamWÅImwU@@a@KX@JVLUVmUaVkUa@m@@Ulmkk°UaVUlKXbVwVIkaVmUk@KVk@aaW¯m@w¥laX@KmakVmnUl@nxVKInU@yVaVIV@na°KlxX@@_lmXUV`VIVV@n@lbn@@WUkValK@²yl@VUV@@K°L@KU@@UVaXIVVV@naVkVa@K@UUK@UUaLWaw@m@K@UVV@mVUUVKnLmVLKbVK@UUIkmI@mUIVK@IUK@VkL@WU@mU@WmUk@I@VJk@WwX_@amK@UUWkIK@LVb@mVmakL@J@bU@Ux@xbmI@`Iwm@UbmKUaUWa¯UkJWV@XJUU¯LUmV@ma@kkamKwLUUmWVkkm@aVUUkVKnVVUmXK@UW@km@Ukkm@@W@UkUy@I@aUUmb¤U@kUmL@bmJU@Ua@wkLWWkL@U@VaU@LUakKWbkUWVkKkLVLUV@JVbz@V@VmUU@kVmK¯@VU_VWakVmIUKUaU@@bml@XU@@V@LmKUVmVUKKbkaUXKUL@x@V@l@mxU¦V@lL@V@Ln@@VV@nlKUaV@nLUbmJnL@VWLkbmV@@LWXLlxVVIVV@x@V²blUVmLVUK@kWWXUlV@Xl`LXl@@Vn@VnbV@lVUVUÈVb@@`UXU`l@@XUVm@k@xmVknUJVXUbmKULmbx@VlJ@LVbkKUbVLÇUUVUVmU@VaUkUKVUwmLkUUVVlbkaXmwKUVVU@@V±Uk@VWUUm»XamUbKk`U@UnWW_kKmbUVUVmnUV@nJVUlUbU@UV@n@JmI@VmbnVUXlx¯kKmnVV@L@VbkVUmm@Ub¯LmlUL@VWLkmkLmmn£WmnKU_mWbnbmx@U¦UJU@Xmlk¦@mnUUm@@Jn@lVÔVJnIVWI@aÆK@I@aVKIlÞnnl@nl`nbÆX²l@xV@llbVn²VVl@nnV@IlW@Un@@kVa°KnÈmVaVXUlaVÈUVlwôUlynIVaan@lVXbI@n¥la@K_n@bÆx@XnJVnKVz@`VXVU`@b¦UV@VIlxUnVKXÈbVllbVbnVn@'],
                    'encodeOffsets': [[
                            109126,
                            25684
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4512',
                'properties': {
                    'name': '河池市',
                    'cp': [
                        107.8638,
                        24.5819
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lLVlbVV@nXVlI@JVXmnW°bIVV@ln@nalVUbnW@kVkÒlbVKn²°bUlV²@X@`nbaUI@°wlU@aXJVI@aVK@wUamIXm@XUV@@bV@VmImnUUwVaVKXUnVK@akVwV@nL@UV`n@@XlnIUJl@X¦V@aUIVm@anV@UwnL@VlbVL@KVVXUWwUUVUka@UVJnUlbnalbVVn@°LV`Þ@XVxV@@bVlUVVbXnWlXnml@XXWVXJmbUI@VllUVkn@@VWV@Vnb@VXUJVnn`lLVka»lVLnw@WV@lInw@WnU@U@mknUVóKwUmUXUU@@wVJVIl@XKVVVbVIJ@Un@lVLnmb@U@Ul@nU°VUVJnnVJV@@mVU@@wkUVwkKWkyUUkU@alkÈ@lJ@xIl@UUWVkUw@Kn@@kmaVUlUULÇUUKl@UUmL@aXU@mlUUwmKkUUVKVUaKUnK@U@Vl@XUWUKlwX@b@K@XkV@UwWJka@aUwmV@U@@U@wUm@»kLWVkIWXnmV@VkbmKLUbkVa@aa@@aVU@aVak£@±UkVU¯VUUJVUI@kxmUmWUbLw@K@aU@@aVU@Kma@aka@_VWkk@UWVUKULWKULU@KUnwVaUKxU@UmaLm@kVmVa@UkmI@@KmIkxU@@KU@mmakI@VLkmWkkJ_U@V@L@nxXbKVb@VVL@V@LUbUlmbU@UUWJUb@VV@@L¯K@LU@UVk@±z@kLUbVl@Xm@akm@U@UUJU_VWkn@`W@kw¯LmbU@UJUb@zmVJULmwk@mVUnlnb@LWkb¦@x°nXb@bUl@LVlUnlbUJUxWakLUVVb¯llkn@V@@nVbUlVbUnVUK@IW@L@bV@nxÆJnXVbUJm@@bnmJnkl@bnnK@Lm@Xx@VVbV@nb@UVV¯@bkV@Vmz@lnLl@kVbUVm@mI@WkJ@UWKkXkl'],
                    'encodeOffsets': [[
                            109126,
                            25684
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4503',
                'properties': {
                    'name': '桂林市',
                    'cp': [
                        110.5554,
                        25.318
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nU@JX@`XLm¦Vb`lVXXW@VblČnVlanLnmVLK@_Va¥@kUa@VmVbaV@XVVzlVVK@knKVmX£VKLlbn@b@llL@xĊôXaV@°È@¤bnV@@Wl_VU@WnVamwwVbn@KVLX@VmVUxlV@nVV_nK@mI@Wn@@IUĊ@@wVWX@@I°VVm@wmU@m@IUVklkUmmkÅV@@aV@@Wn_UKla@kaVlVanb@k@@KlVn@@aV@nIWWUUaVU@kKmwU@UImKk@UU@w@W@k@UkW@mk_W@Ua@a@¯mV£@mUUam@kWakVama@UUm@nw@alaUmnUlVlIVLVyk£Vm@k@UUJkK@kmKUwKkWK@UXImyVwnI@mkUlkUKkUVmw@kkJWUÈm@_k@@aaW@UUJUwU@@IWKkmUUV@nVl@bVb@bUUXakw@WUkbkKbm@xUlkLm@@wmKUX@UaVWXVmU@@UUUxkmWXkKkUWaUaUbL@`UL@LV`UXmK@VmakLVbkLxUJUIVbUVVb¯KV@Xnl@lVXbmÒnV@L@VWKkVUIWJkIUamUUbm@UkU@JUbW@XWxUam@kbVVUnUJmUUV@bU@UUV@Vk@bmULV¦U@VU`VLUL@xVbn@UJ@nWJXXVVV@bkxVbUxL@x¦@UlXUVVlULV@@nUb@xlnJVnlVknUlVUbmU@bVx'],
                    'encodeOffsets': [[
                            112399,
                            26500
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4501',
                'properties': {
                    'name': '南宁市',
                    'cp': [
                        108.479,
                        23.1152
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lKnbnU@Ua@KLlJVX@VnL@bW`Xxl@I@UJl@nV@XV@nXV@lK@UVL@JULVJ@nnJlVJ@VULaLUKnmKULVVU@nU`lIXllnK@UlJnb@nV@LV@lwnJ@L@nJl@VUbUn@lnKnbVV@wVLUbxVm@LVVKXLVKVLXU@VllUX@`lb@bnbL@UV@bV@@b@LxKVanXVUUmVUUUaVUkyUUaImK@mUUVUkKU_@W@UVVVIUWUVaVU@UUKn@k@al@ll@bnL@bVUVX@V@@bKnblmn@V_@aUalL@a@akK@kVKUKlwUUnV¥VmU_VWVIVaX@VaalÅK@LVJnalL@LnKwlVUwmX@VXlLUVnblaUmVUVwXU@Wm¯Va@ÞKnw@wmk»UVW²a@_mW@U@IyLVUUKW@@LX@VUV@@yVU@UV@nwUUmJka@IU@mVkaW@UwUX@`@kLWUk@mkUUm@kUUWkUkWxk@@VK@nV@UVaUUJmIkV@UamLUbkVmamLka@kmL¯WI@wJmwx@akU@aUKmbkaW_nW@_U@Wm@a@wkwUKmk@bkbw@mKUkkU@J@bW@kVWz@bVUaVUx@ULkJWbXVVX`@mJUVU@@Lk@WbU@UJlnXlmVx@Ln@b@KLXWJUUW@kaUVUbmV@nnV@n@lVLVmLXmXkV±@kxÅLUbJWIÅJ@ImXalkUamKkkL±aVwKUU@mÞnbWJXm@lbmKULWUUVkabnn@Vl@VVV@VbVbnLWLXJWxXLV@@VV'],
                    'encodeOffsets': [[
                            109958,
                            23806
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4502',
                'properties': {
                    'name': '柳州市',
                    'cp': [
                        109.3799,
                        24.9774
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@wUaV@nVaUVklmkUUmmIk@waVm@U@VKUkVUkWV@¥@wKVwUalw@aUUUWWXI@mVIm@Ua@wVKUKV_UV@U¥VKnal@U@VU@VV@aVUnVVIVmUUlan@VbXwWX@Va@IlVVn@VanVVblJXIVJlUXL@U@KmUnÑWakU@mkJUI@mk@wUmmUV@JXaWIXWmaUIJkk@WnJ@aUak@kkJ@kUKU_@myUóWUkm¥kUmL@KUKm@k_UmVa@k@@UmU@mm_JWIUVUWLUlbVUJÇVUIVwKUVk@mU@n@lUL@Km@@l@LVzJmUU¤m@UbV²U`U@@¼Vn@x@V@@VnUVx@blbXIVxU@Wl@@LaW@kxLXVWVk@@U@VmLVLbUVULVVlnLVxkV@nWV@bnKVVk@VLVÈVKVVkUnb@lm@@LVxUlVX@VkJ@wkIÇ@kl@blVVVzXllLUxlV@x@UV@nU@UImmUIUV¯mVk@@V@VamnUKkm@@VIUJUaUUWLk@UJUI@xV@VVWVnxLUômVV@VkVVVUnV@UVkL@VVV@bVxla@bkXVJVn`nU@bb@bVL@VnJ@l@VaU@@_lW@UUU@Unlll@XLl@@UX@°bVWVanLlknVV@VVX@VVnUVLmbXJ@nllXX@`VXlmaXVWk@WkwJ@VL@JbnU@bn@@bVKUnVJVIVVVL²a@bV@@Vl@nUVakalmUL@VUL@Va@mXl@nK@UlKL@Vl@@nkllb@Vnn@nVV°lVInwlKXxlU°n@@I@UnVlakUJWkUK@anUWK@_ÞJ@U'],
                    'encodeOffsets': [[
                            112399,
                            26500
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4514',
                'properties': {
                    'name': '崇左市',
                    'cp': [
                        107.3364,
                        22.4725
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@JVzl@V@Xn@ll@VlnX@@VWLnUVmUULVlUV@blnUlnXVVKxnLlb@lnbU@Vn°KVVI@WXUlI°VXbVVbnLVan@xJ@_nJa@wVwV@@a@IU@UU@WKXwWIXKmKUaa@UUUUk@@UmmalbVUXVVKnLa@knWXImanÝV@VLUx²blKlnLVbklWbn@JÆIXJIVaÆKlw²@lUnWWnKUUK@k@mmU@mnUVaVUb@lVXVXIWK@Lam@@KUwnWkkmVIV@Xal@@KV@VUnI@_UWWUkam@kkm@ka@mk@wkJWIUU@WXkWXkWWLUU@UakLWXV±VIVWUU@anUWaUK@IU@Vak@@UUKWa@m@ak@@wUkla@mUaUklakwV¯¯@WWUkLkKmakLUnV`UxWX@Jkn@bmlakkk@b@l¯bmbJb@VXnbVV@bJUkkKWVU@mÛVUUW@UVUJWXkVkKmUL@WW@UVl@XXKWXJ@XVlmbUxnnm@UlVnV@XVm¦VJb@mLkKÇbXblVkn@l@bWnX`V@@IVV@VV°n@@_naÆVVbUVVbUJnzlVUlXkV@Vlx@XVnxbKUK@b¯VVUVL'],
                    'encodeOffsets': [[
                            109227,
                            23440
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4513',
                'properties': {
                    'name': '来宾市',
                    'cp': [
                        109.7095,
                        23.8403
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nVlw@VJUIVVUV°lU²V@l¤Ub@bUV@b@b@bUblVaKnLla@UnUWmXlJXUlKV@V_U±Van@V£nVIyU@K@kn@@LVK@k@mnVl@VULUxVJÈUVIUaVkXKVVUXJIn`@nnV@Vl@@UbVnl`n@VL@LnKlVn¦VlôXVnz@V`VL@llIll@Vbb@mIXl@lIVJnbWXXJWb@IUnVVn@xl@nVJI@WU°LUaVUUaVJVIwlKUalKnb@UnLVWU_@KVK@_KVa@VKU¯VLVKn@laaUkU@maVUJ@k@Um@XmbkyVaUIUU@KV@laVn@KXKWUkUk@aWUUVw@aXKmVaUUkmIlUU@wUaxUmmU¯U@WLUmVIUym@UVmUa@wmw@çm@aWLUJUIUamKmL@ax¯¥kU¥U@±kUVmKU_mJUbkKmLÅÇ_@WWUXUmaVUkKUWW@nVxkUxmL@KkKmbUI@KLkÆbUbW@UbUJUXV`UnU¦mVVkxVLUL@llL@b@bkKVb@bU`m@knmaL@a@@UWVUU@amK@akkk@@b@lmVL@VUVUbVVXUJUU@V@XV`lLUVVV@nnLJVbVlzUVVbVVnUVVU'],
                    'encodeOffsets': [[
                            111083,
                            24599
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4509',
                'properties': {
                    'name': '玉林市',
                    'cp': [
                        110.2148,
                        22.3792
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VJUXVVXlWX@VxVnX@@`ULWUXÅbWK@mULUUmJ@n¯b@l@VULVxxXU`VXXJVIV@nm`@nUVXn@lWVn@b@Jn@nU@Lm`@Xn@WJ¦U@@VnLlV@@Xl`nIlJnkVLw@KVK@UaVL@bVKXlUUKVK@IVLa@U@WLUlVL@bU@@blb@VlbUxVbXUVJ@xVLUlV@VUbVLnKlXJ@Lb@an@VanL@`VLKV_UWl@U_a@WVInlVUUUVm@I@W@wVakIWm@U@XwlaVbnI@m»Va@aXaVLU»@aVa@kKkL@KmU@WzUK@wU@VWUUVUUKUa@mKmbUK@_nWVaUkVaUaVUVLXKVVUVmVI@UkKkLm`UkW@UwWW_UaU@WakXmK@xUXJkUUWUk@WlmJ@km@@aUKzmyVka@kkWVUU¯lmU@@wkkmV@Vk@mÅIUka@Ub@m@UUU`mUbWaWmbXXKWIXUWm@Å@y@UkIUJUUWLUWL@UkVUxW@kaWbKWnXxW¦nm`XLVlUbVbUxI@JmLUKUb@VW@@bkL@b@VlU@xk@L@lxXxWXX°V@VVVbUVV@UVVbULVnVJUb²baUb@VVVVInlV@VnXaVUlIVUb'],
                    'encodeOffsets': [[
                            112478,
                            22872
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4504',
                'properties': {
                    'name': '梧州市',
                    'cp': [
                        110.9949,
                        23.5052
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VbXblVlLXWlnwVV@VV@UnWUXVb@VWXa@kVKUaVaVkUlyX@VaVmUwUaVU@UÈymI@aU°@nWV@VaVaw@IV@VmnLVK@kmmna@VbVI@aV@XbW`ULUVVx@VbUV@bl@VLXblJn¦lL°°@n@K@UlLnKa°LWbnJ¦UÒVUllLlVnKnbWnnV`w@@Xa±nl@XKV_WVkVa@kVyUa@wU£UW@UIVW@@awWaX_WKkVmUULmak@UJUI@±m»k@m»VyUImnmmwnkUmVaVIUn_mW@»Vk@VwkmmUXa@IaVmm@Wm_U@mIUWóLmUk@laXmmkUK@UmKULUUmWUL@VakU@Ub@b¼VUKWb@bUbn¼@mJUakbWx@@VXnlJUb@x@X@JUnVVUVmkUJ@XbV`k@VXU`LUK@_mKUbm@@b@U`@nlV@bUnbVbn@@`VbUbVV¯bm@@mJXb@bVnUllVXUlbUl@LU¦VVmkLVb@bl@V@XlK@V@nUJUz°mwmLmlXbWVU@UUUlIU@VVmV@@¦bXbWxXWlXVWL@LUmkbU@@LVVVJUblzna@WVn@@lIUVnbV@Vlbkbm@ULUKV°UL@'],
                    'encodeOffsets': [[
                            112973,
                            24863
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4511',
                'properties': {
                    'name': '贺州市',
                    'cp': [
                        111.3135,
                        24.4006
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nL@xn@lKVkwn@alLlaXV@lxbVWV@aUa@aUk@mVUnVlXL@JV@VxVIVX@b@bl@@`ÇnXVlI@lxUnlVVLkllV@nmJUxnzWJ@VXLlLVxnL@lLlVI@V@lUnl¤UzK@Vl@LlLnb@VnVVU@kaKnxn@VkVJ@ÅUlakmWIUaVanm@_UK@UVWUa@klXamU@VmVIXW@lUVknVlKVLXVXW@b@VlnnVL@KXLKn@lb@UnW°@VaXWVb°aVa@I¯aUkUaVKVwaXk@aa@wkm@alanUVw@alK@Umkw@UaUmU@WXUaUK@UW@UaVWI@¥Xa@w@WWVXwU@mKUXUWVU@a¯kl@akU@UULmK¯VUVW@U_m`U@@xVbUz@lUbUlXU`WLk@m²Wb@@xU_mXmmamLkUkKVkUVÑ¥mIXa¯KbmLkK@V@Lm¯@¯kKm¥kIWaUKk@@aVUUa@UwVUKVX_WaU@@bUJUa@mbnn@lULmKUnU@@JxUbUbU@mX¯@V@bnJÇz@VUVVbVxUnUbW@kzVUlUbVbUL@lWb'],
                    'encodeOffsets': [[
                            113220,
                            24947
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4507',
                'properties': {
                    'name': '钦州市',
                    'cp': [
                        109.0283,
                        22.0935
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@IlVVlnL@xlaal@nVLlx@x@bXnV@@`mXX`lbnaVL@blV@bwnxI@xXJ°nKl@lbnKnblUVanKVb@lUnJVIVUb@VU@mL@Ul@XwllVVXV@lVnlVnl@XVlK@@_VWVxX@lbUnV@@JlbnIlmnVV@UwVK@U@k°a@mnIVVVK@nXLÆaVWXVK@_W@Umw@UXWWkUUVWUIVaUkJUVWbUmU@mkUJUU@UVab±aVaUIUmVKUaVUU@VUUaUUU@W¯XWWww@k@Kl@wkV@U@alK@aX@@UmIUWUI@mmkXU`U_WJUnUJmUk@@amLU@UVW@UkU@@VbUWVUk@@wmKkUWLUWX@JmIlUkkKWKkLWU@UKWa@bU@@a@_UKWUUUmJmw@nV_@ġğKóLmbU¼VÆ@xUX@Um@wklVnUnlkaUV@lV²WVklWXXbWlkVkIm`UULUU@UWx@XU@@lWLU@kbUbV`UXllUV@bmb@LnKVbULmnVVIV`X@'],
                    'encodeOffsets': [[
                            110881,
                            22742
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4508',
                'properties': {
                    'name': '贵港市',
                    'cp': [
                        109.9402,
                        23.3459
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@VzUJnVK@XV°nVVnwVb@xVVknJlVVUbnWL@bUxVVXbl@lVXkWXwWaa@¥@nUUUV@JVkVVV@XUWanknKxn¯VyVI@m@UkL@W@Uk@aUalKnUUV¥@KVkkaWVkUVkUm@aWanI@n@°aUUVaUa@_m@UamaV@akU@mV_@a@KWIkmLUKaUVU@kVUK@wUIWVUaVwka@Uka@aV@@aUKVkK@X@VbKU@JULVLkVWUL@aUKb@VUL@LxUKmlkImJk_@WU@kmK@UV@¥XIm@@Wn_@KmVm@@I@aUmkXm@UWV@mn_@mUUJWIUWV_WwU@mUknVVmxU@@VUV@zU@UVW@K@X@VLUVKz@J@VnX@`±bUXV¼ln@xmxÝL@Ubn°@XWVUxUVVnkbWVXV@X`ÆÈKnlLVanIV`nLVUl²V@V¦l°¦wb@nKnLVbVJIVXK@bn@ènx@xVbUnV'],
                    'encodeOffsets': [[
                            112568,
                            24255
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4506',
                'properties': {
                    'name': '防城港市',
                    'cp': [
                        108.0505,
                        21.9287
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XV@X°°UlxkbVlVb@nkbVl@xl@@b@nXbVL@Vl@UbV@@JVLXbmV@bVVUXUJU²WXlKVb@VVXKlXWlXXWV@VXJlI@xl@nlbn@lln@lbXalIVK@VwUVbU@aXylUX@@aW@U_UJmUnVKUamL@Kna@aVUkkVWU_ValaV@XK@kV@@WwVXV@VKVVn_lJlUXkWaXWlkXU±kU@VUlbkVmUmlk¯ÝW@mb@¦VxULmkJUU@ma¯wmkX@VóJ±bUVUXÝWklWXXlxUabIğÇ@U@mVUKkkm@UJm@XnWV@x'],
                    'encodeOffsets': [[
                            110070,
                            22174
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4505',
                'properties': {
                    'name': '北海市',
                    'cp': [
                        109.314,
                        21.6211
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VaVLnK@IJVwUaVaUkWKn_mX¥WwXmLXalbU£UyVÅ@Ýwm@°lLÅUmkmwÛaƑLÝUUm@ȣÆV_Ó@£UUV¼U°W̄ÞVbXbôx@b@bmV@ÇUÝ@@ĢU`m@nxnIVVVXVL@`@bV@@aXbVL@XVlKXLlLVlknJ@IWVXXKlVnL@xl@UVVXa@UV@VlX@VUV@nK@bl@nVVIVmXIV`V_lWnn@VJVXnJ'],
                    'encodeOffsets': [[
                            112242,
                            22444
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/gui_zhou_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '5203',
                'properties': {
                    'name': '遵义市',
                    'cp': [
                        106.908,
                        28.1744
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@@UnUlJnwJU°VL@bnVUwlJ@XXVlU@klVUJknlUllL@bUJ@xULUlUblVkblbnwUXmla@wV@VK@L@UXaVKVLXWUVa@U@Im@@W@£UKUakKWIXU@al@@llUnL@W@Un@@VlUV@VIUanKl@Xb@lmxVb@b°bb@nlJVVnnJ@b@LV@ln@LmV@Vx@blnVKnlJXIlwJ@Òb@nlK@Un@UL@VVVVUUUVKl@VUVLJ@UVUUw@Wm@UVÈVlbUb@JLlX@@xLmk@@nlx@bUJUzVJ@@LVxUV@bWxnLnVVK@_K²xVbV@n¥@aVI@b@l@VaKnb@n`nmmýW@U_wV@VlVV@Vn@n@nI@Jn@°¦VaUU@mVVWVaUÅU@aVKnVbVUmmU@a@kUwm@aUUmUUJ¯lakUaXaWUUaVkkamkmUnVlULVlJ@XU@UJWUUwk@aU@WbkWL@U@WU@@XUKmV@aUVwUĕUJUamUUVUÑmnIVJ@kl@XalJVn@KVL¥@UWIXWmU@mVUKnUWLUKUaWUUKVU@U@anUny@UlUkK@w@a@aVU»UkVw@WmkJÅmUUVmwXalLXWWUnam@XkJ@UVU@U@W@@U@I@Wl@Ènlw@KXLWblVUkalKUUVVaV@@wnIlaUmkUKWU@KkUkLWaKUUWUn@VK@LnnWJUIVkUWVnV@V@@XK@VUIUJ@IWJkX@VVJIVkK@I@UVaUWk@m@wnUWKk@mxk@@lV@bxmb@x@VUmLkUJ@nVV@b@VkLVbU`¯Il@U_UW@UU@K¯wm@xL¯¥kI@bkb@Ua@m@kkW@XVbmV@kV@bWbUbV@¦xXlmVk@¦bkaWL@KUImK@wUK@VUIb@bmK@LÅy@akXW@kbWlXblL@ULUb`@UkUymX¯@mUJUUJL@Lm@@WX@lUVlXll@l@Èk°V°X@VU@UVll@XUJVXUVm@@VXLWlnV@Xk@mVULnxV@@bmkL@VWLUbU@UVm@b@ķ¥UnmJ@UUVkkJUlÔU`UIW@°kLUlUI@WVIU@mWKkXk@WU@bXW@J@xX@l@LVl@xLVxXX@xKnxVknbKVV@ULWlXU`@nUlX@llVXVUKlkUKlI@anKVLXKVaUIVWV_VK@VnLlU»VKVLm'],
                        ['@@@KlKkUUVVX']
                    ],
                    'encodeOffsets': [
                        [[
                                108799,
                                29239
                            ]],
                        [[
                                110532,
                                27822
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '5226',
                'properties': {
                    'name': '黔东南苗族侗族自治州',
                    'cp': [
                        108.4241,
                        26.4166
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        [
                            '@@VV@XkV@bUbWJU¼Vb@Vnb@b@J@bL@LV@UVlUI@aKULVb@bkJmxlLVxknVJkxnKmnnL@bn`WIXlWLU@UxVbUVmKVXI@JVIVJ@UL@W@@UmUXUlVUVJXImm@KL@UVmVXVLXblKlV@LXVLlVVnkbmJ@xnXl@bXa@VanaÒLmVnIlÞ¦°k@b@@lVnJlUnVX_@lVlKVUUxVLVWVIXJUlnnWlI@KUaUUVKn@VaVXV@na@mw¯@mUkJUamI@lk@@am@@IUmVImUUw@anUVaUU@LU@WaWUXWWwV@VwnU@L@ynbl@@X@aJ@nW@@Vn@lVLlxnIl@@UWKUnIlJXIVllIVV¼XK@aVIV@@bn@VKXLVKVVVInwJ@UWI@mX@WKnI@KmUUVJUL@VKW@@k@aU@@W@InJWUXwWI@W@¯wkaVaUIl@nValIXWWI@UUm@anwWkXWWIUbk@UJmIUamKVUUUVVama¯VkIVVUlKnXVwX@@WVaUUVa@IlaVmknawkUU@U@mUVUVwl°LVbnJVU¯la@mX@@UWKXU@aV_V@@JlkU¯@VnK@km¯kU@WUW@mmU@kmlU@wkL@WUkL@VmLJ@b@V@bknUUVK@UVKUK@Uk@Wa@LUVVnUbmVk@@UU@@aV¯K@U@UU@WmUL@aU@WVw@IxXll@UXK@KXXVJna@wWa£naUKVm@UU@mUmalm@@XkVm@U@VLmWU@kkWxU@@bVV@VkXVlV@UUk@@mI@KUwm@UmVUUwU@lwkV@IUa@mUaVIVKVa@w@U@UJkb@n@bmJ@XmlVUxWXkJmUkUUVWxUlU@aULUmbU@@WXkmL@xUV@nUxÇm@XLWbnlnVnnUVUnVVz@lbUVVlULVb@V@nUJkwm@Ux@bWbUK@UULkaJbUU@U@lUK@XUJmnJ@bU@UwWax@zkJWnUJUUVVV@bXn@xVb@JLm@Xw@`@bkb@VmXUV¯L@mW@@n@V@L@KIW@@aaUx¯@Um@XbW@@LV@bnVWVkKUzlV@bÆa@lnI@VV@@LnVVKUaV_VJVbnU@bn@nX@yVIVxXKVLlUVaXU°J',
                            '@@@KlKkUUVVX'
                        ],
                        ['@@UUVUkUmV@ln@VXVK@K']
                    ],
                    'encodeOffsets': [
                        [
                            [
                                110318,
                                27214
                            ],
                            [
                                110532,
                                27822
                            ]
                        ],
                        [[
                                112219,
                                27394
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '5224',
                'properties': {
                    'name': '毕节地区',
                    'cp': [
                        105.1611,
                        27.0648
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@UkV@kW@Xn@@KKVIVVIn°@nWVzl@V_VaVK@kKWaXklaX@lW@bÆz@KnL@aaVJ@UVL@xnLVJ@LXKlba¥l@nUWkw¥U@VaXa@amLkUKm¯kmkIUaKUIWkKm@anw@mlwXImUk¯@a@amU`kkKWVkxmUUak_mJmw@wmXUW¯X_@WnI@aVwkWWýÅU@WLkUaUbVV@lUVVnm@kUmV¯kKLwmVUUaWVaaWw¯wÈ@VULUVUUK@nWJkIl@Umxnbm@kbUJa¯bUbVxmLUVaU@VUUWxkVVV@bUV@XWbnlUbbUJlbUV¯b@z`WbXnmbawUwVWUbUxmbU@Uam@VkVawVaUWI@mUKóz@lUlÅ@WIb@xXxml@XklULWKUmwUa¯KUXWJkaULmKkLWbkKUVImWa@kUaULW¯LK¯@kbL@bx@J@bmnnlUlzU`U@@Ub@mn¦°bUVx@bkVm¼mx@mkmVV@bkxVnaVV@bU@mL@b²`lIVV@lXLlbVxn@@bl@XllIVnbVn°°wlbXw@mVa°lVnU@mVLVbn@@b@@WVnUV@Xlxn`VznJVb@L@bV`V@UnwU@WUXKV@UUlmUUlaXalLmbIVbnJVIlVVaUUnWVXnVLk@nWnblnlb²xxVKVXlVXLVWLlUVJna@wVL¼@JVX@`@nnx@nWJU@Vx@XXKUblxU°LVKVVlL@KnbVUnJIlUnKl£VWxIlJ@nVÞUVVnbVX@V_°lnK',
                        '@@@UmWUwkU@Um@@VkL@V@VVkV@nbVa@'
                    ],
                    'encodeOffsets': [
                        [
                            108552,
                            28412
                        ],
                        [
                            107213,
                            27445
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '5227',
                'properties': {
                    'name': '黔南布依族苗族自治州',
                    'cp': [
                        107.2485,
                        25.8398
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@V@IöalK@UV@@KUaVIVVLlaVbVWnX@@LnUlxl@naVLXVVaVUJ@lUUanWWI@VlV@Xbb@Vn@VmVVbk@kU@VV@XJ@zn`ULW@kK@_WVUK@LUb@Jlxn@nnWlU@@bx@XVVU@UbVb@n`VI@VVLUlUIUV@KmL@VV@XIV@@lVLVmXV@WLXLW@U`nkb@Vl@UL@VVVLllX@`lIXbJIXWLaVL@XXWĢb@bmK@L@°@VnxmxnK@xVn@VkL@VLakbl`VnnxVnUlV@@VVXV`@k°JV_UalK@U@aUU@mIlVnKV@U@wnaw@akU@l@nwl@XLmV@xnl@VXUb@V@JlLUJUI@UlWUnLVUUaVwV@XKWkXJm_@amKnmmLwlUIlmUwkKnwlI@aUaVKL@bVJkVUU@@KK@a@I@ama@UUaV»XIVa@alU@WUU¯IWVUbkVUKWLUwUJ@zmWm@@amVUaUIU`VbULmU@KU@@UmJ@kÅb@akUVylLXUmU@aU@KX@Wan@V°@Vwb@bX@J@LK@@U@mX@@n°KVUnW@Ula@a@_x@WnK@IUa@wWm@aUUUVVVIXmlI@ywXbVxV@@aInmVI@WVL@k@VVVaIlbVK@VVLXa@aVwn@lxVI@m@UUaVKUkVUka@UymUVVUmmUmmkXaWK@ÈnVw@mVU@wKlnXW@V@naVVKUk@KVIUW@mk@KXU@Um@@lVk@UVJna@UWaL@a@Xa@kmmVUUk@mkkamJImJUUmIm±aUUkambkamVUU@VlbUbVVxXWVUU@VUakU@UmUVU@mnUVVnUbVJ@bUW¥kLVamVkUaWJU_UVWKk@@nlUVVJUXm@Vm@UnVlmbnmJUbULU@@UUKWVIWxnJVb@xUL@bUJWIkxbkb@xVJbmU@kW±LkKUkVa@a¯am¥ULkalÑlKXUWXaVakImV@ka@UUJ¯aXmmbKWU@wUUaUaKmU@UXlWb¼WLUKUb°UlVbkbVL@VJ@nVlUbUXmJ@VX@lbUbU@@bWb@VnLVJ@bVVUzVL@lnL@bVVVULmKUkJkbm@xVb@VkKVnnV@b@WXUnVlVVXVJUXlVXbWV@VU@Ubk@@KWbUUmL@JnXV°XJ@_`UbkXVVlÆkb@VLXVV@V@kKXX@`V@@n'],
                    'encodeOffsets': [[
                            108912,
                            26905
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5222',
                'properties': {
                    'name': '铜仁地区',
                    'cp': [
                        108.6218,
                        28.0096
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°a@aÈbVUlU@aVKnVVVUlyX¹lWVa@UVnUVU@m@mUl@mÞw@xnIVbna@KVIJ@kwV¥UXÇVkVW@kkKWU@aXUWmnIVa°VXbmL@VVbnVVVUbVbJVbVKXkVKVanU@aWnWUWa@Unk@mVIVK@wXxlLXbVJVlKbl@VI@maXalVVVbX@@aalnkx@b@Vb@Vnx@bVVUXn¤WXn@Vl@Vlzn@`@I@KUU@V£namVkXa@aVKnnU@anVlKa@UUU@amk@»kU¯@aVWnkWmkImU@akaVm@»VUV@UKnkW¯XWlkUKnIWa@nmlIXmWUnwUwWm@wULmaUJkIUaaWaklwkwmJmU@bkJ@XUJ¯W@XbWbUKUkWJUUVKnn@UmmXUWa@mU@@UI@WmXVykwm@kaULWwU@¯lKUUVU@mU@UkmaUbmV@bxVnVUJVn@Jn@@bl@@knJVblInV°@nx@mbU@UWUbm@ULVVVb@LkJmXkmVWIUJUXUKVwVUkLkU@W`UmkVmIU@k@@a¯lÝ¥kmJUnKÑmbUb@Wbak@mWU@UbUVVkLlbUVkXaWK@LkxÇmk@@X@J@V@@X@VUV@VIWln@mbXVWXkKWbnxVUnVÆInl@XUxVl¼UV@b@b@xlLkV@VmzmV@b@VUVVLXVVbVLXKmVVLU@nnVWXXJ@V¦UK@LUmkIWbk@@lUImJnVÒVUnVVbVIVĖUxV@bnUVL@WV@@X@VKlXXaV@@blVxXVVIV@@WkIUVKUkVmlnnbllUVbXVWbblVkb°VInVVV@bnVx@l@bnVVnUUamUL@bVVÆUbUXUn@VVUb'],
                    'encodeOffsets': [[
                            110667,
                            29785
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5223',
                'properties': {
                    'name': '黔西南布依族苗族自治州',
                    'cp': [
                        105.5347,
                        25.3949
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VL@Vl@@IXW@kVUVbnW@XlKVVnUVlL@baVbb@xX°ÔUxV@kbm@VxkxWJV¦@ÈnVKxWXJmV@nÒ@xVbn@@blLk`VX@bla²JVUlnn@U±lw@wnw@mlwVIX@@m@klKnkaKnwmmXkÆVmU¥l@nb°n@aVwVmVIVnI@a¯@mU°l@@VnI@JV@UV@b@IUbVJmXöºzllUbVa@aXUl@U@llLnKVaUa@UmK@UwVbnKV@VwVK@UXV@Vbn@w@UWnX@a@mI@UUKlaUaVk¯VaVLXK»XaWk¯mkğwmW@mIVkwJUIÇVwUUkVKkm@UkmU@WÅwm£Vm¤¯IkJWa_lUbmJzÝJkUÇVU@bUÝnm¯LUb@`mL@VkL@VUmmk@UU±Umka@kU@ķymUkk@mmkÝmUaUakImV@V@VÅL¦JUXmJXWb@n°Æx¼nV@LlbUUbmL¯@ÞbV¤nbVx@bUVlblI@KVVUnVJUn@VlLUlmLUUUxmK@I@@VW@@bU@UJmUkLVVUl@b@V'],
                    'encodeOffsets': [[
                            107157,
                            25965
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5202',
                'properties': {
                    'name': '六盘水市',
                    'cp': [
                        104.7546,
                        26.0925
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ôyVL@nXJVUbxbUlU@nVbV@naVwaVUXVxxbnaWmXa_@y°aVUkaVIaVamkXa@WVU@aUUlUXwVV@UVbVUnKUwVa°abVIlan@manw@VklJXI@mLVVVUVK@UÇk@KUa@UkaVU@UVWV_XWVXVWlLXKlLXaÆKwVL@akKm@Uw@@XUVk@VUI@wWK@aUVI@UkK@mLW@kImJUÅVmkXUW@UJkx@nmx@xkxV²m@kmUV±Ikb@aUWl_kK@am@Ua@wÑ@mnUWIXwULm@ÇU¥XIlwUwn@laU@Vw¯ÓW@waUab@akKUmVUUkL@WmXUaUV@lWX@Jk@@UUKULmLUJmzkKmVX°VUnWKULL@mU@UnVJ@b@UV@X`m_@l@@bmbXJmnn@°wnn@VLX@V@nVl@nk@@bl@nn°WlXzW`XXVKnUlxVbUb@VXb@VxÈbVlnbmn@kVUL@mLUVVL'],
                        ['@@@@UmWUwkU@Um@@VkL@V@@V@VkV@nbVa']
                    ],
                    'encodeOffsets': [
                        [[
                                107089,
                                27181
                            ]],
                        [[
                                107213,
                                27479
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '5204',
                'properties': {
                    'name': '安顺市',
                    'cp': [
                        105.9082,
                        25.9882
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lL@bUKxÅLWbkKWLkKUXUWWXU`UX@VUVlb@VVb@Ll°xXxbbXUVbVnUxKlL°nUlVn@UmVU@kUUVablVXKV@ÆXþlXUxnU@mVK@_@ml@UU@blU@KnLVyUw@@UmkWVw@UVK@VXzVK@nVVUUW@kVJnla@nKWkaWL@Uõb@JU@mU@@_WWL@lUU@WUUK@lakÅUUlWVa_@`WIU¯mW@InKVVXa@Ll@VaV@@UXUWakUVWUIUWUkUmVXW@@amUUmLl@UUawn@laIVlnLVKUUU@amK@kUKVyUU@aUImK@UXa@aV@VakaW@@UnIVWVaUkb@mWX@Vxm@UaU@W@VULUxU@mLaUx@VnL@VVbUbmLkK@kVk@WV@bUbVakkyõ¹nWUIVa@J@aVUU@@ImJ@Uk@¯V@n°@bmJUUJUnUxbm@¯mak@¦VUnÅWlnnmxLbmlkL@l@nWVnlÆUVnIlJ@XnK@lL@VJVU@bXL@xVJUl@VU@W@Vxn@'],
                    'encodeOffsets': [[
                            108237,
                            26792
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5201',
                'properties': {
                    'name': '贵阳市',
                    'cp': [
                        106.6992,
                        26.7682
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nlLXVJLVblJn°lnLlVnKlU@nUUa@WlX@ln@Vb@la@alJ°¦Kwn@°xLVkUmmwUmk_labK@UlK@UUm@wLmnwmw@U@¯@KnL@aaġXWW@UKbKWXJIWakJ@_kWkKUU@UVKk@@UlamV_X@WKXK@WUUnUK@kU@WJU@@UnK@LVUVJVkUK@UUJm_@UaVaV@UU@Ww@aV@Xkmmm@kw@IVa@KVLXU@`lLX@VKm_@yI@WU@UlVl@UanU@Um@UaWaU@Uk@XJmXVbkV@IUVUbWUUKmbk@kwmV@K@mWUXUakbKUUUJVb@LU@@VkL@VXKlbXmL@kbmUI@lVXUVU@mULWy@UUL@VUxXnl@V@VxUzmK@LkVa@VVk@@n@`UL@nmV@bmJ@X`WX°WVn@xnxnIl`VbnVlwXUlLl_nV@b@bl°VnWJkx@nmx@b'],
                    'encodeOffsets': [[
                            108945,
                            27760
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/hai_nan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '469003',
                'properties': {
                    'name': '儋州市',
                    'cp': [
                        109.3291,
                        19.5653
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@à®¼jpnr``pRVHÊÌ¤Zt^JÖA[CâlTébQhRPOhMBcRSQiROE[FYdGNOEIH]MgEAMLLIAG_WMCSL@ED]PCLYC[ZIHgjSxJTMbHNEFCMEE_HSDFHSLECRNSFDRICHNADGPI\\RZGIJTIAHLDQOHG`GTNCOIC@eIGDWHIS[kiE[FMbECZS@KKS[FDWsCeRuU_DUQNOE[LKGUBM¨EDQP@HWHGDImXCog_~I_fGDG|QDUWKBC\\ore|}[KLsISBHVXHCN`lNdQLOnFJSXcUEJMCKSHOUMDIm_DI`kNDIGEYFM\\YPEEIPMSGLIKOVAU_EBGQ@CIk`WGGDUM_XcIOLCJphHT_NCISG_R@V]\\OjSGAQSAKF]@q^mGFKSW^cQUC[]T}SGD@^_aRUTO@OHAT'],
                    'encodeOffsets': [[
                            111506,
                            20018
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469005',
                'properties': {
                    'name': '文昌市',
                    'cp': [
                        110.8905,
                        19.7823
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@hĲ¤Ī¯LQDaFßL[VQìwGF~Z^Ab[¹ZYöpFº lN®D´INQQk]U[GSU©S_­c}aoSiA£cÅ¡©EiQeU­qWoESKSSOmwćõWkàmJMAAMMCWHGoM]gA[FGZLZCTURFNBncVOXCdGB@TSbk\\gDOKMNKWQHIvXDJ\\VDTXPERHJMFNj@OwX@LOTGzL^GHN^@RPHPE^KTDhhtBjZL[Pg@MNGLEdHV[HbRb@JHEV_NKLBRTPZhERHJcH^HDRlZJOPGdDJPOpXTETaV[GOZXTARQTRLBLWDa^QAF`ENUPBP\\Eji`yºEvåà'],
                    'encodeOffsets': [[
                            113115,
                            20665
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469033',
                'properties': {
                    'name': '乐东黎族自治县',
                    'cp': [
                        109.0283,
                        18.6301
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ªVLP`@PEdNRAHOPEAKHEVL`GZBJfvdTAXNNTZJFPrHHNpKTD\\ILHbEVd^JOHLh@NNBnHP`\\xH@NBRLJTlNv_^CTLd@bNDVFbxdFVUPBTKOGEOUO@OEBXQP[H_EI\\EbeYa@UO_JMEJ_IEDKJUGMDcNUd_FMTEJSGoZ]EIYGO[YWgEQ]a@WHEDQKUSDUGAbYBUpSCYNiWqOSQEoF[UcQISWWNMSDe_cLQ_UBiKQOOASQAWgS­ā]ZaSPÝZ]XMXS[^oVËNgNKlE RôEø'],
                    'encodeOffsets': [[
                            111263,
                            19164
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4602',
                'properties': {
                    'name': '三亚市',
                    'cp': [
                        109.3716,
                        18.3698
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@®ĂhTBXTRPBRPjLVAR`dKf`TCNXMTXRJVdE\\FpTRrPjXZMTDVoZABaVHTCLVCRGF@X^bFRhZXP\\ZHHMA[^wBWXJlW¤EJ[bCTOFWWMm@ILMGWQ@DQ^QNWFSHEbF`OXNbOVNKTEPDTLTCCVTREfvfEHNbRAENH^RJXCFHNFRpVGHWISDOTMVCZeGamaLoLÛD¹¹ėgsia{OųETtlÉwr}jR±E{L}j]HąKÃT[P'],
                    'encodeOffsets': [[
                            111547,
                            18737
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469036',
                'properties': {
                    'name': '琼中黎族苗族自治县',
                    'cp': [
                        109.8413,
                        19.0736
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bRFnHNbHgN@NPEnbXP@bND`NT\\@\\QZb@`@J]V@XhDpWnCJGHGXO@CR§FANHVKLF\\MPVR`CvVfQtDPKpGHG@S`WJP~^dSTHWX\\RHTFACQTIAUPOU@MG__IaYSFQKNSbORHXCZeTFJgB`YBMNMFi~IVDV[tGJWXGDQRGF]JrALgESLSAYDGIaFeXQLS\\MKSLSQYJY}eKO[EHiGSaK[Yw[bmdURgEK^_kcSGEOHKIAS]aFSU@Y]IWFUTYlkP_CUOUEkmYbSQK@EMWUuAU\\M@EpK^_ZMDQ^OXwC_ZODBrERURGVVZ\\DTXcFWNIAWJWAYUUFYEWLQQaCIZeDM`cLKRGpanJZQd'],
                    'encodeOffsets': [[
                            112153,
                            19488
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469007',
                'properties': {
                    'name': '东方市',
                    'cp': [
                        108.8498,
                        19.0414
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ºxJYZQIYXLl@dR\\WZEn]bA\\S~F`KXaDeTiNO^EEKWEDQXITBXaWaDQMUJOIaTWf@NJV@dSxGZFu_@WMKAU}AQ@MwG_[GOAmMMg@GKP]IUcaFKG[JSCoLGMqGEOYIMSWMSBucIeYA_HUKGFBLOFGPQBcMOF_@KO©UAtERadwZQ\\@ÊJÒgòUĪRlR°KĮVLJ'],
                    'encodeOffsets': [[
                            111208,
                            19833
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4601',
                'properties': {
                    'name': '海口市',
                    'cp': [
                        110.3893,
                        19.8516
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ńZƂtĢ¬æßFuz¹j_Fi[AOVOFME_RBb]XCAKQKRSBQWSPY\\HbUFSWSPoIOcCOHIPkYCQ]GdGGIFQYgSOAQLK`MFUIGa@aQ\\GGUFcHKNMh@\\OYKAigsCgLSF]GOQO]@GM]HyKSHKPW@Pxi@EMINYREXWRQ@MQcFGWIAwXGRH\\yDI`KJIdOCGRNPNtd\\UTMbQYi@]JeYOWaL[EcICMUJqWGDNZEXGJWFEXNbZRELFV]XQbAZFrYVUBCLNFCHmJaMIDDHXHEhQNXZ_TARFHVB@DTQIRR@YHAJVnAbKFUEMLd\\c^ÍÞ'],
                    'encodeOffsets': [[
                            112711,
                            20572
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469006',
                'properties': {
                    'name': '万宁市',
                    'cp': [
                        110.3137,
                        18.8388
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@^J@ZTVbET^JBGLFPTHld]`FLQhcVanx\\\\ZbLHTGj\\FLP~fIZRZPVTQFSVAFJE^NDLEE[~LjsxVTG\\NZZNGlLRRGLJTV@hPZANN^@T\\NEPPbDZXO`d^HSvcJDIV\\XZAJUFCLNP@PQ¤@[ïKLÑIÏ]ÇE±I{u­YśUćFcYUmsVeBSVgB[RO@aYYPO^]@UVaNeDShMLG\\EfFVE\\F`'],
                    'encodeOffsets': [[
                            112657,
                            19182
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469027',
                'properties': {
                    'name': '澄迈县',
                    'cp': [
                        109.9937,
                        19.7314
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@T\\GJCXJH@fJDDPNCNJENN^NLHBNSx@DDYbBLLDRbjZTj@`XXTlG^Xr@PJLW\\WLTlWR@HDJTD@X_PO@STMDNTMVV@NLDM`M\\XM\\JNBH[PYZúYzŸ`Ċ\\ÎÝd]c[NKVFLEBaUmBIZGQ@JQSR@CUAEGBQ`SWYRMFgWGCGJCbNnIDGMEDKVAZUEqBYRa^WEUFKYQMaFWXEHIFWMYHCrXVIIiaK@aMCUYNSIISTwXALKH@XWXIEIJQCG[IEQDE_XSBaa[AIPW@]RS[FWS[CD]PEBYNGFSaSyJG]@ugEUDQlGHiBKHUIoNSKqHFaPMICK]UUHIPDJMuCA[SCPIDIOILGAEmU[POPBVSJDREBGS[QXWSGcT}]IO_X@TGHoHOLCX\\ELT@LYTDaFENF\\lj'],
                    'encodeOffsets': [[
                            112385,
                            19987
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469030',
                'properties': {
                    'name': '白沙黎族自治县',
                    'cp': [
                        109.3703,
                        19.211
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@D\\RV]dTXELnHr]^@LETBBRTHPi^[@U`QTHDJ`MGSogDIPKdJ`WVNHCXHl_DJR@AH`FBVPUJLHKNTJOFFZON[ZEHFCJlMJ_Cn`CJVNGPLTNDFIdVTWEIPmRKMc_kDMWGGUTAtJLK~\\f{pqD[LAVXRCH{HC`eJ`}@W^U@I@_Ya[R[@MSC_aMO@aWFmMOM@haGGMEmaQ[@MESHaIQJQMckBIw[AOSKKAMPSDSLOAV_@@`KJRbKRDfMdHZERgAWVsDMTUHqOUr@VQXTT@TfgL^NH\\@heTCZaESNObHPHeZF\\X^ElM^F^'],
                    'encodeOffsets': [[
                            111665,
                            19890
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469002',
                'properties': {
                    'name': '琼海市',
                    'cp': [
                        110.4208,
                        19.224
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@TP\\pATHTGlZDJGAQjE\\Rb@jVBDCN`JZ[NCNHNXbULPrP\\KNbMTLjJJRFP`pNLZz^FLRHjVPZ@hxVKbHBHMNNJFRlLzGPnNHhIrHHADcPWdUAmEMVQDSKYHY\\EhBN^HpXGNDBNNBnIßÅ_g{³So]Ã£@ORO@KMEDIVYB[WJUICudGTc]P_YWaCOOMFS[]@MMYBgOU@ISHKQQkKMHYY[MSHwUit}KF\\KFMCF]EIUBETSROUKTLT[NKTWREfJbCHBZKTFTKh'],
                    'encodeOffsets': [[
                            112763,
                            19595
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469031',
                'properties': {
                    'name': '昌江黎族自治县',
                    'cp': [
                        109.0407,
                        19.2137
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@`ZĤd`òü BSPGP@VSbQ`@]HC~T^SE]N]FkW]E[fYGGOPaTMbFDYfS@g[MGK]he@SSSRW@UVqrPVGNStCXUhBFQGYNcCeLQQaLI@_`@EUwcEaCUaMc@SK]Du`MSkKI~BVNL@X`EvYwHcTU@MIe@SXJbIPNVCRXbWbSAWJCRXFFL]FMPSjCfWb_L}E[TaBm^YF[XcQk@WKZJYRIZw¹ '],
                    'encodeOffsets': [[
                            111208,
                            19833
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469028',
                'properties': {
                    'name': '临高县',
                    'cp': [
                        109.6957,
                        19.8063
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@jD`hNd\\^dZädĒH´Op@ùZY\\OAGIMN[[W_NCNMKU@NUMSNCTSP@`O@WSCCI@GXQSkXKX[IK@OWqH]SkWW@_SiiYQaKCAKZaCCw@MTGAMKM]FMMIMDSM_HGHRPKCBGSJJIYH[QOJCHMBDGQJECMTDQKFGTCEGTF`NFEDMFaGSNwIiTGhYJD\\KZODC^@FTKND`XBHKJNKFBNhG^FJMPcHEZF\\QPRjQTAdgNOPgQaRSê'],
                    'encodeOffsets': [[
                            112122,
                            20431
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469034',
                'properties': {
                    'name': '陵水黎族自治县',
                    'cp': [
                        109.9924,
                        18.5415
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@R]NC`YL]FoN@V[vBXVFNL@TRZalnVFVP`DlOZkVSXEE_F[EUFeH[NKTgfCbMVU^@P]ZObZP@\\QhATUfAtUasñiāEoI]eYǯ@aKmaeWuCºKÜKpnbHbYfUDSNCPJTRAHJTDJSfDNLHXC``VBNGTYCQDIXMDSP@xLNEFRNXBIpVNLXah@RgF@`qOML@LJNSPLbaHAh@Jdj'],
                    'encodeOffsets': [[
                            112409,
                            19261
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469026',
                'properties': {
                    'name': '屯昌县',
                    'cp': [
                        110.0377,
                        19.362
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@\\OnVBFKHPJCJOJTDB\\vDINOCGJVVL^JDONEbrGTLpMVJLGjAHGRkVChF@vH^zIbTETMHAZOFC^\\DXT\\EffAP\\PdAV@UIYfS|S@YPICMeM@sC[_A]VQEwyHSMuNcAUlQJMVGMS@mVBZPFO\\CSFQK[LqDMACiUa@[QiFBRIHYCHkGSBS[oSOqBIE^QHCRWHIXsHU\\UC}JEjMNAN_ZAIhSEYfWDQGaPMTLERZTJb``NHV@'],
                    'encodeOffsets': [[
                            112513,
                            19852
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469025',
                'properties': {
                    'name': '定安县',
                    'cp': [
                        110.3384,
                        19.4698
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@JjDNdJ\\FbKPXfZ^Ij@RZNaVSc[MsMOHQPDJcLIJ_zCG[HQxWJBHXdENRR@XQFWZQQGOFSWUCI[WCJuRGLXNMPLhCl[Ta@SqGgJMGOmyHkKEQMINMAGaGULgwY@UOGiKQ]EYyMKoO_QEIIKiNSMa[LqOKOaVMWMGMDY\\_IKrL\\ERT[DEPYOUA@nNTUHINkRBVMdNvGTxzRF^U`BD\\@tfNDNOJ@Z{TeTJZ@VUcB[OBOeeQT@^OXBJb\\AbWTF`RCJFH\\RDJIJFXW@WLGBKxWTSJJMTVZND@bbL'],
                    'encodeOffsets': [[
                            112903,
                            20139
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469035',
                'properties': {
                    'name': '保亭黎族苗族自治县',
                    'cp': [
                        109.6284,
                        18.6108
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@FJp@fxpQ\\ApN\\GNPNBM`HLMrXLXj\\PEHnI@WUCEM\\GTc\\GZYHTPBHRCPTdH\\K\\@HXiBJILJJAVNTOZJNtFPC`YxDPWci@IBgbGKaTOIM@KNKrP@_hE@QbgKWUMJoWAQMFEKM@wTONCJWRCZDHSAM_UD_GWMKeCITSCGIQBGXUHQoMEEGWDQIG]FMQBMaFGueFeSQDUSDSKOCSFMLUaPWM_PaEGFETMX]RCRR@HXKN@JNnXXESPaDI\\£FkXWIAX]xB\\GN'],
                    'encodeOffsets': [[
                            112031,
                            19071
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '469001',
                'properties': {
                    'name': '五指山市',
                    'cp': [
                        109.5282,
                        18.8299
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@TCNOLBTLBPx\\AJdlNRRIbJTGNF\\@RcIYbmHoLQdKN_fCJYbDRRXKZFVEZVXBXIJBXMdESW[CUYHUVQFQAqsEIMPYMSBUIIJKAIjGW[@[LGScDOGQOAGSYZ[HSd[HFNVD@XmJFG[OWiWKNqGKN_MAMO[HoM[BoRewo@Y^HpITSFENc`MVCdHNIVCLJFI`NFIP`@VZbaf[FFJG`O\\WRFA@PVPFPPH'],
                    'encodeOffsets': [[
                            111973,
                            19401
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/hei_long_jiang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '2311',
                'properties': {
                    'name': '黑河市',
                    'cp': [
                        127.1448,
                        49.2957
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VÈÞ@kxnX°VÈa°V@kôwbJVkXlVUx@lL@xkVV°VbxlVUnVxk@KkVbIl@°kVl@lÆnkll@@VVX@V²bUlVlVUVÇn@nkJlkVb@x²V@n°VUnlKUn`@n°bWLnVUblVUVVbknV`°kkl@@V°@nzJ@XxlWXb°n@bĠlbXbbVbJ@Vba@@lbUbVmn@lVmnIW@WbÞ@n@x°@ĢaƐéϚnlČ¯ĠŻÈwm@ôçUmm£Xy°UV@wÈ£Ǫ¯kõÝçUÑUķĢkVÑÆÞU°nŎ¥ČUĊx°m°¦żVƐx°Ç£@yUônÞÆ@Èĉ°Kô¦WkWUbÇ»@ÈĕWÇÈ£ŤU@n£ÆUUKVamanwÅmÝJ¯k@JIkaVaUUÇbkaÆÑkWmÝUÛÝ@wnU±@kkV¯KUkJ¼U¦Å@ówķaķůV¥Uaó@Åwm_kVwĉĉmmn_V»a@UVwķóU¦LǫéóXÇmōLǓÇķxÝkĉkmakbUĶ°@W¼@bÈÆ@ĖLl@°J¯mkl¯LÝ±LamJ@¼VƧUóUXċb¯ńVbkÆÝI@llxk°V²V@UxÞL@b@b`ÇzkókÝ¤@ğ¯WLĉÇLmmnċVkbUaL@¯bU°ğLÝÝ@'],
                    'encodeOffsets': [[
                            127744,
                            50102
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2327',
                'properties': {
                    'name': '大兴安岭地区',
                    'cp': [
                        124.1016,
                        52.2345
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kϙmƏêġb¯@@wmÝ@XV@Ill@bUxl¯VlVbV@ULVlUV_kxVVVÈÝJ@¯Ulm¯x@xóÒĉ¼m¯Wxţ@Uz¯WwnUwť@knW£óVUUwğyó¦WIVmmI@±kwÇ@@b@ĉ¼ó@¯wó@¯aó¼KÅaUwmWUwÅI@aKó@UaLaVÅwō¼UUÝl±I¤VxÇx@zkJmnnmbnzxll¯ČkJl°@kbmx@x@kêmVnWxôXxU°bWLóJnÇWĵV¦UUbbÆġKk¯VU±aXmċÑUwĉKġkVxkÇKkbIÛXWl¯bX¯KbĊÞVÆnĸ²lxU°n°òÈb¦xVb@¯Vx@¯VķÞČlĊ°KĸȘI°¤ČIôò»ƨnȰKǬ¦ôWŎÈƨwlnKVXmbX`lbwkVWXXL°aƾaĊ£n°@°¥ŎzÞ¥»alwôkƒJa@ĶK£bU°ĊxźVÈUĠ¥ƨVI@XU°x°Ln¥w°UmwXmÝV¥Ģ°@nU@mÆ£¯lKÜw@aÅU¥UaÝIkmV²nn@Ķ»@Uk¥VKÞ@ÞÛ@kVmĢa@_Jómǖ¯ÆwóÇa@alUwwĢřk@wÆWXUWXWam@_ƒ»ÇéXaĸwVa@ÝKkUWkXkKXxn@lĊV@¯m¯nřÆw¥'],
                    'encodeOffsets': [[
                            130084,
                            52206
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2301',
                'properties': {
                    'name': '哈尔滨市',
                    'cp': [
                        127.9688,
                        45.368
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°`_JlU@@V¦°JUnLôlnŤ@@ÈaUÒVbkbl¤zk°ÇVÛô°IlVUVôUxÆU@bźĀº@¦b@l²UVl@°ÒĠxnXxÆVô¼Þ@Üx²KÞlVÑ°UȰôlwô@²ĸ°lanV@VŎUll@bÈnÜmwĢ@la@ÝÞb°UXblŎ²ÆkVI@nJnĠ°knÜbĢwna@akÞKƒĀaIVbU¥wĠwkôxnLċVçkaU±IUmnġW°WôĉalÞÅĵ¯@W¹XÝab¯a±X¯ºLaVmkLóbkaVUKVkkKV_@aÝykk±L@ÅU@yV_aU¥ówÇx@UkVn@lkÅlwWVwUkĉmkklW@abVwnWWwWL@UUÇLÇm@wJĉL¥@Ý_@a¯yUWw¯¯Uġx¯aÝXVmaU£ó±¯nwa¯óÅVXmanUlUXkWa@mkIğamIklÇUkĊzkKlUōĬl@nX°@llUxŹ²mKĉVWwk@UbUK@bmVmIVmwaWxXlWČmºÞÆbUxV@ĵńWÆĉLkWUbaWzkbĉ`U±LklōwUVÝ£UW`Uwk@mk¯VkaõVX@WbLK@XƧºWzxK@lmX@bkVVÆk¼Vbk@Vn'],
                    'encodeOffsets': [[
                            128712,
                            46604
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2302',
                'properties': {
                    'name': '齐齐哈尔市',
                    'cp': [
                        124.541,
                        47.5818
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Þ@ÞĠKV¯a°@KVblaČUmnnKĊÈKX°Ġ@Þ£ôllÈy_@a@aKÝVwU@±¯Ulkw@kÞJlÅUa°ŃČaWVôƨVU@»nIb²KÞ°Klkn°¯I@kK@ĕÇÅ@aX»¯@VĵlaÿVamI@aÅÝउýĊȗJôȁÅkmƑÛ@kxġ@@laVk¯»īŹak¥Å¯JUaWU@@wa»KUkÆkUmUmwÛ±±UUbUUXwWwÆÝklkUanaWwnKlkal¯kaƽakÅxa¯@amb¯VlÇwÛĀV@xmêVÆVVaôVwÈx@ˌx¦VÞ¯VlmX@L@¯Ua¯LmV@°XċKV@UÈ@¥@wġIUkm¥Źw¦¯lmn@°kxVV@¦óamn¦l@nxlĉVómxnÒĉĀĊ¼þǔêÞ°ˌĠÞÒ°ĀɲĀƨźˤȤƨĊ°w@£nymwnkUUV¥ôÑVmkÆmUUVamVIkmôlxkXÞþbll@kVƆVxV@¼VÒ@UnnÞJ'],
                    'encodeOffsets': [[
                            127744,
                            50102
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2310',
                'properties': {
                    'name': '牡丹江市',
                    'cp': [
                        129.7815,
                        44.7089
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@U`lLUlVLUlbaôlKnUbK°¹²W°baÞbknyUlUkamř²L@m°@lm²n`ôÅlKxÜKnxV@l@ÅXyW_k@wmŹĕmX»Ûl°ôÈ»ôô_WW@Ual»wU@@wUV@VXI@wĢ͑ÞȻaU_@mUkly@¯óV»XmWUXUWmnm¥nUUaWLk»Æ²IÇawÅaÝ°¯nUa±a@¦õÆğ@@ÅbxUÜnÇłlb¯¦ôó»m@±Uk@Wwa¯xUV°xXbÇÅUVK@¹KUaȯ@ōÝXallÛkalÇUǫÇÅÇakbÝƆ¯nl¯@¼VUx@x¯W¼Æ¯mĖĬ¯ČVkķÅmx°ô²V¤bUnÞW°bĢw°V°XxV°z@bÞ`@¦KĊI@xnÈÈKV@VXKxXmXUxab@kXllĊnVlUxXkxlÆkm@UVl@ÈwôxV¦bU`@zÆV@²KllÞz@b'],
                    'encodeOffsets': [[
                            132672,
                            46936
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2312',
                'properties': {
                    'name': '绥化市',
                    'cp': [
                        126.7163,
                        46.8018
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ऊþÆÞ@bnJUbĀnblĊÞlĸwǔÈŎKÈnôWǬêKV¥ĸôUx@VbU¼m`nnĊĊxlUmkaVÿLw@°»UmbKmÝUwUmVknKUUl¯KUUÈnK@ĠkX±lX°L@¯¥@wV_mĵ¯WwL¯UkōÇVUlwVó±¯aVka°wVk°mÞ¯ŦřÆl²ŎkU@mUkb¯ķ±ó@kxȯó¯VUÒkÝ±LÛwÝ@ó»ÅUWwmğw¯Ñ@UkV±@ka@¥¹Źÿ@aÅVwóVVUkU¯JÜóÈUl¯yk£laUaVÑÇb@ţ@kmómKV¯IU¥@@kVI`@ô¼blUlbÈb@xÇKkĢɳaÅɆō@VK@z@@¥ÆKnÜ@@aÛUwwnUķ@_V°@klVnULVVÞbVl@°@nxn°LÅÆlVÈmU²@VmĠLxn¯xkWzJwnLmbXbW°Æ²@x@JVxLĀ²Æ°I¯ºÈ@ÒnÈ'],
                    'encodeOffsets': [[
                            128352,
                            48421
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2307',
                'properties': {
                    'name': '伊春市',
                    'cp': [
                        129.1992,
                        47.9608
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@K¯kWW²ğl@mLÇVVLk°VVmLUlVnxVnÞLnaV¯¼@xKUĀlbn`nÆxô@VbU¦ĸŰĸbôxÆ@V¥»IVl°LUll@²mVx@ÞÜÞVnlXÅÒlbÈaVVUblbJ@I°lÞInÆmxnbUbVLÅVm¤@ţVÇ¤XÈÇĖ@È¼aXVÜaXbWnzŎařKôbUlw@¯naÆKnUU¯Üa@mkkVUĊmżÝǖK°L²lÆI@¯¥ĉƛVaÞk@ÝVaĠlnUVwóma@wĉ@aVxamX@a@UaÅLaVW_nWm£nWm_ÅV¯m@mó¤Ý¦¯ÅalmX£VWUÅwmÇ@@IVWUw@aI@k@wŎ»WÅVaKIka@¥lUkUlwÅwVyÈwWU@a¯U°mÇ@UçaVa¯mV»ÅwÝUlUkV@kmUkX£w°@@ÇaÝIamÛam¯lğmmI@JUl±ÅōkWa¯VÝa@Þkbġ@xÛnÇm@akkōVōl±kÅťŚÝ°¯nUl¯xlbU°b²ôUxkVÈUŎVl°KXxĶ°nU`@x°¦@'],
                    'encodeOffsets': [[
                            131637,
                            48556
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2308',
                'properties': {
                    'name': '佳木斯市',
                    'cp': [
                        133.0005,
                        47.5763
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nbÞJb@È¯@xW¤Vln@lUVlkÞVÆxU¼°nUbbVèÈ@nIn@ĢmlUw°żVUn@lnL@VôbwĊlJķĸĢlwôwƨxVVUŦxLźÈ°`nnĠwŎJÞĶwôJ@¤XnÜĸln°¼È°lUbx@l@ÞÞÈm°lôwL°¼ĸ°Þ²nĠ@ôwÞ`ŤIVÒĠU@VJĸbÆ²@°ĊKJĶaĢȰ@ô¥°n¤bČU@VxmUw@aÝţÇķ@ĕķīU¯²@ÆmVÑô¯X¥ċç@ĉ»U¥ÝţKWVÅkUVÝŎUmÇÝx¯aķxÛUóL¯a±óōb¯ÑÅVÿ_Åķa@UK@wm@Van@UmmLVa@VImmXUWÝUÅKUwÝUUkVk@l¯XÅ_J¯kJmÅLa@¥U@¯Vz¯@`@¼mxƥŏKÛk@±laÛ@@Xm@@xƽ@WŎnˣĕÅ@@aÅ@@nÝbÇ¯@_UkUWkbwÝU@çWlw@anI¯lyX°m°VaÛm@mVwÞK°XlaXmm_@UkwÝK@VIXmV»I@a¯ğWbġaU_¯JU¯ġĉkō`±nÝÆkbóĊ¯XĢXmVn²JVlbUèČmKwlóğxxV¦UaJbƑÿÝLl@bmbġx'],
                    'encodeOffsets': [[
                            132615,
                            47740
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2303',
                'properties': {
                    'name': '鸡西市',
                    'cp': [
                        132.7917,
                        45.7361
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@LKVVnkbVÈb²U°VnklVlaÈL@anU°ÜmXV`nôLèxlLXL²aVVmÈX@ķlnUÈl`È¹@Ť°U@xKnnVmlnnUllVnnaŎwlVÞÒ@n¦LV°lwVkLaÞlnÒ@xmLÞ¤Wn¼WÈLVVUxlÈôWVaU_VKKXUÆbnnôKbÞw°bÆWXamVwKUw¯WUkUlJUwVUa@@kmyzmĉw@kVwkW¯ÅKU_VmxU@aW@@kK@wa@K@@kVUaky°_Vmkna¯K@Lwġk@@IÇóXwVakmV@mwXUWanlĉ@ÇUwKóܛǊÛm°@wÅ@±b¯W¹WVwŹĕ¯kVmōb¯w@awmVUUbVIkaVwķxk¼b@VXXó`ó¼Çó¯kÜ¼WnźĖnxl@X`WzÆ'],
                    'encodeOffsets': [[
                            133921,
                            46716
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2305',
                'properties': {
                    'name': '双鸭山市',
                    'cp': [
                        133.5938,
                        46.7523
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@UUwómÑÞÑUÝÝUkmmÅyV¯ī¥Uÿĉ¯mÇkaWbÅX¯aÝxaóLmmÅaWVLULV`UbXókÇVwUUÇKX»XmÝ£nK@wmÑkÝbKUlx¯kUKm¥@ÝÑkUōxmbUmkVkmmnkUmmL@w¯Vţ@Çºk_ÇmVk@ĸVxVÈ°lLkllUbōwnVW¼nlUx¯XmWUnÝ@xÝUó¼¯J@LVbkJWnkbW¯ÝLUxn@nÜb¯U¯nWkz°mJ@bkxX@èÞVxlaXlVV`°@ÈÞa@mÆ@@bÆ@ˤĖmXōƾ@@wn@@WÜ@kb@²ÜlŐLƦnw@»_°@y°UV@@¦bÆKnI°lIÆ`°W@kllUVÞVVxLÆÞVXWVnnUJ@UbnKVnm@Ubn@@xL@VbÆĸ`UĀÆÒ°Ŏa²ô°bôKÜVĸw°bÞwÈVnÞōVUÆlXU'],
                    'encodeOffsets': [[
                            137577,
                            48578
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2306',
                'properties': {
                    'name': '大庆市',
                    'cp': [
                        124.7717,
                        46.4282
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@mÇ@ÑÇ°¹¯J±ÅÿKUwI@w@±ÅX¯WanamKxIylX°wmwğKUn±@nVÇUÅkÆ¯Kmmw@@¯UkÝaUUVKmUlk@¯U`ĸ@VmxVxÜ@bÛ@mÅL@¦@@yLUŎ@ÆɅɴblġÈL@wÇaakkVa»@ó¯_ÝJwÇaÅXnyU¯¥Å@wbÝaLmm@@VUlbğVm¯Xm_`¯_UxmLa¯b@maó¦Çk¤V@bóJknVxVXx±aLUbVxkLVlLWl@nX@VÅbWlÈnxbWÅbm@xbml°bXbWXVmnn`Lmnbmb@k@mwU@@¯Jlbk°lbkmLXxmbVbkllÅÞxXxVWVVa²VÜ²nxVVnÅlVlL¼b@xV@XVbIÆ°¦lźbĬ°¼Ulb@kĢ@lw@ƒÜlnȂÆóȘIĉ'],
                    'encodeOffsets': [[
                            128352,
                            48421
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2304',
                'properties': {
                    'name': '鹤岗市',
                    'cp': [
                        130.4407,
                        47.7081
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Þ¥ô£nn@°ÆUn`mXn¤mX`UXbÆKVb@@bnWbwUbĊ@x@nbWVm_mm@ó»UmÅWXkĠ»²¯¯nķwŎ@ĊŎK°bĸUnÑKČ¦ĠÈbÆknJÆUĢV°IVƾwaVkÇ¯¯»mķkÛWm@£óIĵxÝōIğxmm¯_ÇŹKwťUVUƧwóxxġkĸķIkĉxóa@UmK@kVmUŻ¯Vxkġn@mmJ¯n°V@bXVÇxUzÆxkxlVkV@¦lbJLUbÆXō¼@xl@J@bVxXU@JÈ@nxVÆUXW¤knÆb°'],
                    'encodeOffsets': [[
                            132998,
                            49478
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2309',
                'properties': {
                    'name': '七台河市',
                    'cp': [
                        131.2756,
                        45.9558
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²mŎ_lĊĢV°°IV`ĢbaĠX°@bJU¼WnUJ@ÞLlxV@n`lIUa@K°Iô»ÞVwÞ@VmnX°WVwmkX»UmŎxVaklkkKÇ¯UUwÇWUnU±bKWKkwçóKmU_nW¯ÛmV@bÇKkbkUml¯U±VÇaUamlUULKk@U@mwÛLwkLóÆm_±nk¯@@n±KnŚlbkVVmzlWXº@Ķ°'],
                    'encodeOffsets': [[
                            133369,
                            47228
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/he_bei_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '1308',
                'properties': {
                    'name': '承德市',
                    'cp': [
                        117.5757,
                        41.4075
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lLnlmxnIVVlUnb@VVxXJWL@LÞVnnVJ_@wkmKbxwXkWXXKlb²K@nVVVbL@WlU²lKVnUJVz@VVb@lÅ¼mVUVnbôaVX@°Ub@lWbX@b@bVb°x@VxÈLVlaÆ@Þb²k°@lVU@Xn@VWLXb@¤VXKVVVLnm°_ƨ¤@aUIVaalkX°kV@alwUVyU@kó°na°UVUUmUÆw@mkLVUWVIWLnn@xlVnKmyU@U°UXaV@U¥U@UÆ@aVUkWU¯aU@WLUV@bkbmKULmKkUVUkmVIUwlWV²Uml°U@WLUwVm@UUK@_KUUÜaXw@VKUU@mVIUUlmnIVVVbÈVlKnbVK@nI@nVnwVLVKKVnb@aUIVW@In°@lVnI@lWĢ@°UVL@b@VyUUa@w@WUnU@WÇ¯K@UkkJWaÛbmk@mVaÞU@amkW@mXUKkÿ£@akl@Um°UXwlaal@nmlXnW°znW@awV@akbĉ¥VmU@IVUJkUmWUKbmkUaKkUVU@KV@@klwWaU@kmXVènbmlUUKX¯JkbI@JmIUWU@Lml@XkJ@UkK@aVKwWaIWwmU@mU@J@UaċUaUUVkI±k@UU@UbVVm@UVKLlkIWaULUWXUJU@WbUb@lkXUxm@@JVn@J@bnb@Vkx@bLUÆnJaVXnKVVmzX°V@_lJXxWXK¯bÅamU@lUIbñJ@LÇKkIÇ`kxWL@@@bUVUb¯xWKkÅVlULW@n¦Ul@IlmUUUVm@kWnkKma¯XUKWmnwVwÝLmVUbUVWb@LnxmxVmbXx¦@nb@`V@kbLUmVUlkbVXkºmnm@@xk¦bĢÜl'],
                    'encodeOffsets': [[
                            118868,
                            42784
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1307',
                'properties': {
                    'name': '张家口市',
                    'cp': [
                        115.1477,
                        40.8527
                    ],
                    'childNum': 15
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kġÛal¥@wn@nml¹UWlaVknUVKla@U@_ma@¥WwnaUwnmw@KXaVUVaUnmWUk°lnUVUXWVwIWVóKUI@WXxUU@mma@kUKWLkw@yk@aVkUUċaUU@Wk@Unm@UVmLm±IUkJkW@aI@m@UVUla@VXVXmVwnkWKKU_k@m¥mX_JmnU@km@U@KmUVU@U@Umk@@LmW@Û£Wka@wk@aI@mmk@mUa@UmUIwW@aWUbU@kbÇ@kw@makVUkU@am@aU@mxkUbKUXU±KXVWLUK@wkU@V@WXUa@WbUxJI@¦VèVVX@±ê¯KUI`¯UULVx@V@UKIVkLmVkKm@nUJÝbkIUJVXVVxVbUVJUn°bVmlU°XnK@Ul@lVÈVUXx@W@VXVKÞbn@VnbVm`UxkW@UVkLKm¼@lUnUJVnVXV@Vm@@LVklIkl@VWlULWKUL@mJ@blbUVUlmzUJUxm@UUbċÜk@Ub@VLVV¦ôbVmUKUkU@m@VlVn¼WbUJ¯@@°nIllÈl@nXWlLkJ@bkxlxkxlXUlklJXL@bWn`@nÆXxlL@xl@XbLKlVlIXblVUbUJW@lX@VL@VVXJwn@WnL°KbVbl@VI@K@U@nmVmV@XUWI@aXm@VUUkWmn@lmUUk@mUmK@UnwVĉ@mU_V@XJôVVULVUn@llUnJl_n@ml@XlLlw²LVJUL@VmbVblVXmVnl@Ť¦nn@Ü@bl@@XV`Unb@VlLVb²JXn¥ÆÑ@¥Þ@'],
                    'encodeOffsets': [[
                            118868,
                            42784
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1306',
                'properties': {
                    'name': '保定市',
                    'cp': [
                        115.0488,
                        39.0948
                    ],
                    'childNum': 23
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VbXW@@UlV@xVLXKWU²LVVWLalVnwV@@bn@bVVllUnb@lxÈ@laV@aXV@bXxJnV@VVb@nnl@nJ@bll@aU_VWUwVUkUmUkb±mVwU@VIUW@UWk@VU@ynLm@IV@bnKLVaVmnIlaXwV@@WVL°@@xnX@V`V@VbUVVLVKnwnL@ll@@_V@VVnaÆ@KVXÆ@n@wKmUWm@km@kÜKXU@ÑW±nIUwVKla@I°wU±kkmm¯m_JnawW@IVaUama@wUmU@mVw@aXk@mWa@£km@a_kVmUnWW@¯bkUmk@VÇm@@kUUKUU@UVUamVUaWIkb@xU@@amUkKVkam@@kVUkUWmKmUkLUb@xmJU@UImVÛVmnUwJU@VX@UWm@Ub°¦UmxklmX@`ULU@@UW@@xkn¯@makVUmxUb°lUbUbnUJUUVaLkbUUJUU@mUUUJka@xUIWJUnJ@Vz@kb@`@bln@lb@X@@@XlbnbVb@VJlInlbVw@UKl@lbnan@VbJôLnUzlV@lÈLVbVK@LVxVWXX`WxXzbV`UXV¤nx@bVlVnVlUL'],
                    'encodeOffsets': [[
                            117304,
                            40512
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1302',
                'properties': {
                    'name': '唐山市',
                    'cp': [
                        118.4766,
                        39.6826
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VVl@²lJUVVbČVVb@@InV@VnXxJXbxUL@bLl@VlI@WnkKV@VXnJ@IJla°IWLVVnkmaUçWVkôaÜ¯@nV°wnJlaV@VUnUUaW¯wXWWwna@£UaWKU¯¯@aVUkKUamUUn»anIVwUWlk@LlWVakU@K_lbÞU°@y°n@KÈkWWţ¥ĉōkġWUw¯£¯Çwţw@kK@k¥ÝwÅbÇ¤ÛťVlW°@ĸx@VVVULVLkl@V@X`Ub@Xm@UWbk@ÆVbnLWV@lnXUbl@X¯lmUVkKWLkK@_UK@U@UmmUxmVXLWVULkU@`W@ULUK@XlJXzV@@xml@VU@UX@Kk@WbUK@Xn`XmJnmkxUVbUVlVVxUbV@nKlLkVKÞbVKXI°KVmVUIUKULVxVJVLkV@V@UbU@WUU@UbUK@b@nV@VkLmb@b'],
                    'encodeOffsets': [[
                            120398,
                            41159
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1309',
                'properties': {
                    'name': '沧州市',
                    'cp': [
                        116.8286,
                        38.2104
                    ],
                    'childNum': 15
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ln@UÈl@Vnl°aX@mXnVlU`@bln@¤Xb@nWl@bUx@nnVV@xnbVbUb@JXxbmXa@kUVwlWkKôVm@wkkK@kl»ÈmVKXkla°@XVV@VI@ml@@Vn@VX@V@J@VxUzVV²blVk¦@Ġ@@»@VK@VÈLlK@XnJ@alIUlaVVb@n@aU@WUIV@mUn@mKXml@lL@LnWb@XV@@aVVbV@VVIVWÈbIÈ»ƒǟlWaVUÅUUm@kVUWVkaUwmaóUJUU¯ÑU¥mk¯UaKÅnÇyóXmWÛX¯aċbÛaJWÝU¯»aóóUm@IVVl@bLUJWLX@@xXUxl¤V@VnVUVXVbV@@@VVn°V@ţU¯VUmUWV@mUXabUKUwUaÇKnVk¦Wb@VnLmV@bkV@nxW`Å_UVV@bUklVX@VmlUx@VVL@xVWVL@VW@UUm@'],
                    'encodeOffsets': [[
                            118485,
                            39280
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1301',
                'properties': {
                    'name': '石家庄市',
                    'cp': [
                        114.4995,
                        38.1006
                    ],
                    'childNum': 19
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@la@y@UImVXIVJw@lbIVVnV@VVIVVlaKbVUVVImVaaVk¯VanwVlUnb°@lm@wX@@VV@VK@_nWlknwV¯¥Van@VX@W@UVIVxnmÜUnUVJV@nI@wValKnV@kmU£na@mVk°KLVa@UU@UmknWWkXU@aWW@@km@UaU@@klK@UkaWaUnamm@Ua¯wWU@UkL@Un@xVlUXVJUbLmU@aUWUkmKkLUUm@mWXammkkWUm@@U¯JUUmkU¯@mKĉxÝwÝ¥LUómwkUUUWVkKmkKmLXlxVLVxXJ@nVJnz@VWL@`nX@x@kVUUmJmIXxJVnUV@UVV@LU`UXVVlXL@l@b@VmX@bxn°UbkKWLXlW@@bKmKULmakLUlmb@Xb@xmXU`Vb@`lLx@nWVXL@°WlXnlbKVKXVb@X@l_lJ@V@XnI'],
                    'encodeOffsets': [[
                            116562,
                            39691
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1305',
                'properties': {
                    'name': '邢台市',
                    'cp': [
                        114.8071,
                        37.2821
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nKlLnlLXUVVlVnxôVKÞ¦ÞxĊwnL°@lVnVV°I@Vn@VlXnlnbWnXn@VVlKnLVlVX@bnVKVaUIVWkU@wVm@¯@U¥VmU_°lKkw@LXVaU@wUUUKlUóW@UVUUl°KwlKU_naKVnlKkkWWa@IJVa@IlJnU@KVUUmVlaXUl@lm@kXWÝÑnk±k@wğ@@U@mKĉLmVJ@zmlnWLUÝJU_@@mJkXUVlbklÝ@Ýab¯@¯±JÅwġaUU@kU@mVI±bUKLWUXJkaLóKULWbUVkKmnk@@bmLUl@b@mnmJkUULabnmn@lVV@¦n@l@bznx@`Vz@bxnV@xllbnKVx'],
                    'encodeOffsets': [[
                            116764,
                            38346
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1304',
                'properties': {
                    'name': '邯郸市',
                    'cp': [
                        114.4775,
                        36.535
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bVKlVnInm@@akVnK@al@nmlLVUXaVKôLKlbIVWXKVL²aJnU@lV@VVĢbÆx²I°°@aÞbÞ@lkkaVUlWnI@@V`ÞIVXKmnk@yInUĊKÇkUUamUUk@aU@Uk@WUwVkVJVkkw°a@mK@UX@VVLVW@wwVa@¯Xm@@lUIWaU@UWkXWmU@UwmUkKmn@lkV²VaULUVmJUUUwLma@UmkIUmLmVmx@bLUamKÅL@VmbkU¯KÝamzkJUb±VkbL@lU@WIkJzkKmKnUalWkkKW@@nkbk@WW¯XUVUJ@XlJ@X@XlWLkU`VUnaWaUV@UVIaUxUUmVK@I@W@ÇU@@U@b@nmKXmx@UxkVWUX@`VLlL@`zXÝb@b@VUVkIUJVz°KVlnLlKnLxlLVVUVlXUJ@nnI@mVUlbn@@m@bVnV'],
                    'encodeOffsets': [[
                            116528,
                            37885
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1303',
                'properties': {
                    'name': '秦皇岛市',
                    'cp': [
                        119.2126,
                        40.0232
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lnV@Xbkx@lU@@LUVlVLVbnlaLXVVnlIVUJV@UnĊ¦lab@nJ°UmV@wn@VUJVI°bnWlXnWVLVK²bakklI@aUaVUwVUUalaVwnUVak¥X@WkLVÓmmUK@_lW@n_UK@alÅ@ğÅƑŃÝm@ÑţÇlL@¯mz¯@ÝVak`@LlVUbkXK@klVXUxJmbm¼VnVVblLUV@b°V°XLVb@¤mbXxWX°xXVbmVUVU@kbmI¯xmU@Û°óbUl'],
                    'encodeOffsets': [[
                            121411,
                            41254
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1311',
                'properties': {
                    'name': '衡水市',
                    'cp': [
                        115.8838,
                        37.7161
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@KVlV@X°xb@VnnmbVXblb@VkL@lV@Vbn@@l@XX@bWVXlmXnlVV@@VUbK¯LUl@nmbV¤n@lLXnlVUV@ln@lbUlLnV@bV@@wlaXJVbnUVbVU@VVLVVn@VVX@@UKXUU@wUK@UwVnk@UUWlkV@aUVUÆ`X_w@mlU@anUmK@UXal¥UmÈLVbVxVLabVW@nXUVnV°UŤV@U¯Um@U@@UUaWVUmUUU@k£VwW@wW@XKIUa@wU@@al@UK@_mKXKbUU@aVKm@Xm±@kbÇakLğVaUw@a@mkUJk@ykw@£WX@lknk@WVkbUVnUVL@mVkI@JUbI@JXbXllkLUmLmbV`kLx¯LkVUV@VôXkVVLVV@xVUbW@KxlL¯kV`UnV¦°@'],
                    'encodeOffsets': [[
                            118024,
                            38549
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1310',
                'properties': {
                    'name': '廊坊市',
                    'cp': [
                        116.521,
                        39.0509
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@laU@UnL@VWbklWxnIVVV@XJlbUlXVbn@@KmV@@X°WVInJmn²@lmVbnL@amKV_kwlmX@@LVamaXaaVU@UnJVanLlUkaW@UaVakK@IlKUU@an@ln@alKUkIVa@a@klaUKUV@UkUV¯KVV@kUmU@@a¯ImJUU@VV@UL@U@@WXUWa@Ukwm@X@@w@al@@aVIUmVUUUVWUknK@I@l¥kU±aUUVyUw@@I@UUWm@@Uk@@nUJU@WU¯@kbWlULnÇk¼@llLl@xUnóLlkXUxV@lWbI`°nnnllV²¯x@JkbLUVxmJX²@ÒWVÛL@lln@XnnVL'],
                        ['@@@kX@Valaa@KWI@UXW@WanaUIW@UaUKķk_W@UVUKU@b@UamxVXnJUbWVXLVbn@W°kb@U@Wó¼mIU¼k`V@bVbl@lX@lUôVlUIV`lXVn@lUlVn@l@UVaIUWl£UmVWU@@UUKlUUUnVL@KUnLVWUa@U']
                    ],
                    'encodeOffsets': [
                        [[
                                119037,
                                40467
                            ]],
                        [[
                                119970,
                                40776
                            ]]
                    ]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/he_nan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '4113',
                'properties': {
                    'name': '南阳市',
                    'cp': [
                        112.4011,
                        33.0359
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lKl@nVV@bn@VVnmnLLXx@VLlKVUIXWÜ@Člbl@XUĊUlwnWLÞwm@ÞUVmnVl@nXJXLm@VnnJlaI@VkxVb@VlnJ@knKVn@°aVanal@XK°b@¯VJXIVK@al@nVk@nKab@XL@blVVKVLXK@VaVI°mVaX@V_@a@yUkVwVIVaJ°@anIlaV@nKnXÆm@wUUV±UUWUKnaWwXUWmÅ¯Vam@kakImUK»lan@VXXaW@@UlUUa@a@UlwUV@Xal@@anIVaUK@VXmwVmUmVLXl@nalLnal@nKlkV@@UnJUXnl@nVl¦V@@VnJ@nUVVVVIn@VaJÆn@@K@mka@kmWVaUI@a@k@@aUL@mmaVIUKUV@@IU@mUmmL@K@UUUU@mW@@nU@ğ»mVmbk@klW@UXnV@LJmlUnUJUUUW@UnkKxmLa@@@lUUbmUVWk@@nkUmam@UakJU_Vm@ÅlÇLUVmVUwULKU@k@UVUlU@@U@UaUUWaÅzJaWLklb@bmL@kKabWUV_@mV@b¯JmXUbUK¤ÇLUU@b@JkLWmkUWIkJ@VmX@JUbVXU`¯VV¯blK@LXKlUV@Um@@Uk@kxWkbL@KkbmL@UXmaU@@l@x@blX@xUJ@bULUlULÇ@@VnU`W@@nÛ¼U@@VmKUkm@VVX@@xÇ@bUbVb@VX@@xLUb@l¼XLlbUlVVUUb@n'],
                    'encodeOffsets': [[
                            113671,
                            34364
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4115',
                'properties': {
                    'name': '信阳市',
                    'cp': [
                        114.8291,
                        32.0197
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VllInJlknJVkVU@mXlUÞ`VnVVU@U@y@nXlKVnJVkXKWaXIb@yVkVUkVwn@K@nW@kKlUXVVUlbnUV`n@V_V@llX@@Vb@bV@@nlVUb¯WLnbmb@nLnKbUbVWnLlaX@VVUX@Vln@`kL@ll@VXVJÈIVl@XÞJ°UnaLlylU@UXKlnn@lanLWWnbVI@KXKVL@LVWVL@UVKUIVWX@@XÆJ@In`@lJVI@aWÛnK@UlK@UU@VKnlmnXalUllLUbVVknJ@nV@Vm@al@@xnVlJVUU@w@ak@XW@_mWnUlŁUmVKV@VXwW»XWaUwnkWUkVUU@@@WlaUkkaIWVkm¯xmIUmLUVaUIó»m@mmwXk@amk¯¯l@wmkLmmU@UbkUWJ@XUbJ@b@l@znÆmK@Xk@Ub@lm@I@akmVKUUVUkU@U±JUbk@IWmkxa@UUVUWVkIUaW@UlLWn@VkJI@VkK@L@bmKkJmUUaUKWXk¼VxnJ@V@@VULV¼@@UkaUlWL@U@W@IkKmL@KULUWULWKUXUJmIbK²UWnWKUUkLUmUUam@UU@mUL@xkV@VV@bmV@Vk@mwkUVUx@mbXÇnVbUL¯WnUVLVb@xnlWnU@UVUVVUbVVlVkn@llVUXUWUXVbUJ@bmLUJnb@nVK@bl@@@bVJUbnX@lb'],
                    'encodeOffsets': [[
                            116551,
                            33385
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4103',
                'properties': {
                    'name': '洛阳市',
                    'cp': [
                        112.0605,
                        34.3158
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VVUllLXl@LWn@J@bKUVmnL@`VblLnbV@b@JmL@LnV@VV@¯VJVnXL@nm@aÞ@ak@mImVbXLynLk°@°aVJnUV@UVVXk@WJ@VXLlUnJVnn°U@»°Uwl@bWmUXÆ@VLXU@m@Ua@Imkba@naWW@_@WXUV@@U²@K@I±U@¥kKWLóLla@£Um@kWKXU@mlLXUVKUU±J¯_@`UL¯Wmk@WakklUnVUVaU@KUU@mmK@_a@KX@VaUIm±kaVKVUkw@kaW@kbkL±UUaK@UUKVak£@UmmL@lIkmU@Ualw@UJkbmIUmn@WKImWk@mUUnÝV@nÝxKmXkxĉVWVk@kaċÛ@WXJUV@zmVWnbUbVbLlUnlUÒnWVVWnk@@Vm@kxm@Unl@Ll@@V@XnkJVV@nlVXxU@ln@a@VLnWĊ¦nx@lbVKXLl@ÞVLXJl@XXl`lIXVl@XlXUVKwV@lanxzUbVJ@VVX@b'],
                    'encodeOffsets': [[
                            114683,
                            35551
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4117',
                'properties': {
                    'name': '驻马店市',
                    'cp': [
                        114.1589,
                        32.9041
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@b°UÆXnVlnLÜ@VLm@n@na@Jm@k@lVVxXX@V`lLVXVV@VVÞLVV°²@labnxV@@bLmlm_VWnIWUna@lLbnV°VL@KVLVUVaVLXK@mÆXna@wVma@Xw@KlL@a@Va@wUkaWnIVla@Kn@Vn@VUl@nKVnJ@LnK@aVkVUUW@VakUVanI²XW@UUU°KnUVLl@XaVK@aU@KUI@W@_lm@KkLUKV_U@»@UVJ@XV@@mVL@K@U@Kk@VwUUm@kmWL@VkVkzKmb¯VÝI@WUkÇJUIUWk@@klK@_km@UVWUUW@kbmKUXaVamLmK@namaXK°VakU@mU@@aa@UW@kkU@U`m@U_mVkaUVWUkVL@lmX@Lm@UxVlUUl@zaWJXbWLUlmIUkLmW@@z@VUVUUmÝ_kVW@nUVUlmIklmIkJUkl@n@Lm@ÅIUbm@UJUUVU@mmI@UU@k¥mUk@WmVmI@VU@klmLk@mbkKmb@WkKUVnUnnxW@UVLUbmJ@bk@WbU@Vkx@V@bVbkV@V@XWbUWm@kb¼VLnlJlb'],
                    'encodeOffsets': [[
                            115920,
                            33863
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4116',
                'properties': {
                    'name': '周口市',
                    'cp': [
                        114.873,
                        33.6951
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lnb@xlJ@UnLlKXUlJl_KnV@xVL@bkbVVUè@Wb@UbmkVmbXVJnUl@a°@@bLVblXxInmnLVwanJÆw²IlmnXVl°VVbÈaVb@lkn@VWnLlUVmÞUUklkVkUaVaVaUwK@kkaVWmw_l@nUVVb@baV@VV@zXJl@@kl@lk°WVnÆbnbUVJI@VKVm@kK@_kK@a@aU@@wW@@k@aUW@IUWVUnLlUlVXKVwmk@W@VWa¥@k@lnUIÇKUaU@UUVmIUVUk¥Vma@¯k@Wanwm@@n@@m@UIVkUVamUXWaVU_@mUVUImW@aUIĉK@VmIb@lU@@nJkU@KIUmmLk@UVm@Um@@LkbUmJXlbV@xUb@@bkK@LWx@bUn@xmbÅW@nWLUKUbUVKU@LUK¯mU@VV@xULUVL@bU`WUz¯aUamKUa@@xkX@x'],
                    'encodeOffsets': [[
                            116832,
                            34527
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4114',
                'properties': {
                    'name': '商丘市',
                    'cp': [
                        115.741,
                        34.2828
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XVl@lLÈ@VkV@V»UanWX@VaÆÇô@ÈaVX@xVJXUÞUaVLĸbXKlV@m°Vn_nyXX»mUk¥lK@a_@yInaVKVa°_@WXI@@KVnIlbnaV@l@a@_w@lwUKmXa@UV@»Vw@kUKVUUm@w±VUXUKUwmJUU@km@@±mXkmUI@mmKUwkbWakLWaUIkJmX@l@@VUX@JWbX@VbULWblUVULknlV@bVJkmb¯KknWmk@@nmVkx@VmU¯KUnUL@JUIVmaÅaUm¯Xlkk@@lk@WI@yUUU@b@aUaUmVk@`nxUXlb@lLVxUbUbVbUllkVlÝVUnkVmKUXm@kl@nUx@xnxn@`VX@V²x@V@b@Wl@zU`VUVVbL@VbW@bkXllkLWV@V@VVÈwlV@@XK²LlbWnnÆL@VnJWn'],
                    'encodeOffsets': [[
                            118024,
                            35680
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4112',
                'properties': {
                    'name': '三门峡市',
                    'cp': [
                        110.8301,
                        34.3158
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WKUmUI°U@@UmU@KnK@IaU@makKUa@_KnmVUL@a@IXm@KWkkKVkUU@aUW@UUIVaymwkbU@xLVUWWkk@WUkJk_WWk@WIUKÝk@WKULka@mwĉ¥mXUK@@bm@kVWwkU@mUUlIWm@@Uk@@KkVmn@lwn@@Ul@XmUXUmVÑkmkVKUaVamaUXn@ykLUK@WwKmKnUm@UmaU@mUk@kL@lxċxUnkVmnXxWb@`kzWJ@VLmVUnlmUL@lW@Ub@VXUb`VLUbUJ@nmnUlUUm@@bUJlnUU@lxkb@@XJUn@kb¯VVVmlXXlJlzn@VlkVW@bkKbmkUbVblXVxKÈnwÞlĊKlVnKlwX@lL@xlUnVn@l@lmX@ÆÈb°¼ÈwVJlx_°xalUÈxlUnbVxnL@lllbmn@nb@@VL@V@@VLJnIVVlKnV_'],
                    'encodeOffsets': [[
                            114661,
                            35911
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4107',
                'properties': {
                    'name': '新乡市',
                    'cp': [
                        114.2029,
                        35.3595
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XVlLK°bUblbUbl@nX@WXVVKVk@@mb@UbnW`kLLV@VVLnKlVXIlV@@a@l£nWlkVa@°bnUlLVlnabnUVUXKlU@@lk@aI°y@ôkUU@wmônkWakmlUkVmkUlmUUm@nkUKWanamULXW@UVnUln`lblL°KXV@ĠJ@L°JUVwanK@UUImmkK@¯±Um@IVmUmmÅnWaUK¯aUkw@W±kVxUVwnÅJUIWaÝJóIbm`ÝbÅImJUI¯¥¯@mU¯UJmnUVóUkl±V@zXlbWVXL@bmmº@@XmJUXU°llk@nWJk@U@¦U`m¯Wx'],
                    'encodeOffsets': [[
                            116100,
                            36349
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4104',
                'properties': {
                    'name': '平顶山市',
                    'cp': [
                        112.9724,
                        33.739
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l¤UbVL@VLVb²VlKlaX@lb@lxUVULbln²VJUbW@@Lb@`nL@nVV@LVUbUVmkVllXbl@Xn°VK@_°`²IVVV@VUVJnInaWK@U@KLÆ@nmlXXWVUUw@klKVa@knyVkVanIJXUl@XbVUl@@aa@mXkbnK@UlK@UUUVaXaWmkUm¥nWmXaWakl@VmÞbKVL@aVI@mUwVm@KÅméULKVaUk@kUK@UWXI@VlKXU@VVnInVV@VLlK@UUkKU_@WWUwU@kln@@Imb@@mnUKÛ@mKUkWVXxmbVLXVVU²VV@xÅnmWmLU@kbmJ@b¯IUbJUUxVl@z@bU`W@Ub¯nUJUb@WLUKULkU@aWK@abmL@lmUk@@bULWJUI°@¯aWLk@mbUb¯b'],
                    'encodeOffsets': [[
                            114942,
                            34527
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4101',
                'properties': {
                    'name': '郑州市',
                    'cp': [
                        113.4668,
                        34.6234
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@nWVUKÅ@WnVnIV@kÆwV@nn@lxÞlnôJzXJl@nalUČVll@²UlkôVVUnmI°VnV°@°¦VJnIÆJÞan_VmU@ama@kU¥kaUklw@UIV¥kVUI@mmUÅmUlwVU@amUJWbUakVVé¯Im`k@wVWmLkU¯XkWmLmx@UUbm@@xJ@LbW@UUVWUkVK@kaIUamKUkkmmLUkJUVWXkWmnÅ@KL@@VXLmbmJUIUVU@ULWVkK@nWVXL@lVn@¤bkôKXKlL@¦²V@JL±@@VU@WV@X@`XXmb@blan@Jb@V'],
                    'encodeOffsets': [[
                            115617,
                            35584
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4105',
                'properties': {
                    'name': '安阳市',
                    'cp': [
                        114.5325,
                        36.0022
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°kVaV¥kVmUkWkWVkVKUwkkmKUU@awWWXWakKWkXmlaIVmX¥U@a@WnK@kVI¯@KğI@WU¯LkKak_kmmVU@VWXKnVmbXbVLmln@VVknlVUnVlklnXbmlmlXblnÈlWbn@@nK@VLbVV°VVzln@VxIbU@WLUa¯VUkWõ@¯kkmxk¼lXUlVbVLnlULmU@lLkVUlX@xW@¯mU@UmIUWL@aXakU¯anWk°@kkKmmUIWaambUkkKmV¯a@UblkmXk¤@@b@UbULWVnb@lUVVnmnVVUJ@bWXX@WJkL@blVU°UV@XlWnXUbW@UVkVVWbnLUJWLUK@Lnn@blVUnUblxVUVJXUa@UbLnUVV@mVIVVn@UbV@XbmbUV_lVXUWanJVI@WkI@WVIVU°WXXl@la@mX@lLXlkVbmXylIXJV@@kKla²UVaIVyÞb°LlVna@UÆKnLVbK@anwU'],
                    'encodeOffsets': [[
                            117676,
                            36917
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4102',
                'properties': {
                    'name': '开封市',
                    'cp': [
                        114.5764,
                        34.6124
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lUVbXaInV@bUVxknVVÆnn@VJlUU¦VJ@kxVllb¦lV@nb@bVUnaôJÞIXbVJÆImxUVwU²l@XxVl°bVLXb`XklUnmVblL@lmx°LVK@UXIVaWlL@Uk°KkVaVUXmmI@UÅKmmXka±KL@W@kUÇxUU@@UXUlKkklW@aXa@UKUaVUUV_@yXk@@a@U±w@UUW@_mmw@wVwmUaÇbUa¯UUkmWkn±JÅxmIbUxmKmnJWwkUaK@a¯@bk@mVUIWLmwm@Ua@WJUb@LUl@UUmLUbWJ@VL@VmXWWzUJUê'],
                    'encodeOffsets': [[
                            116641,
                            35280
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4108',
                'properties': {
                    'name': '焦作市',
                    'cp': [
                        112.8406,
                        35.1508
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@V@VL@x@bXWV@XklUWX@J@nI@KlLKUVaV@JlL@KUk@KÞLl²_@nWlLUVV@nLWVUJVn@anV@awÞUVLVxb@lW@lbXnVn@@¼L°mKVn@bnl@nVK@blbLWU@VWLXV@nlKn@lVVbXw°nV_@¥Vl@XI@mlkkV¯VWnI@W@n¹n@aWKXUaWk@yk@kċUkVmbk@WIyóImÝkkwm@mU@xÅlU@mJXak@x¯V@¼¯VmUmmIkVWK@UXIl@UWVUU@mVUI¯b¯@lmKzWKUanJ@nlbÝ@@b'],
                    'encodeOffsets': [[
                            114728,
                            35888
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4110',
                'properties': {
                    'name': '许昌市',
                    'cp': [
                        113.6975,
                        34.0466
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lIVnKlnVlnLVbJlb@ULVlUXVVX@a@KI@wn@aVV@nwnKlXW°lVnKUXx@ln_°JVIXyXnW@UK@UXIVanKVV@Vk@KVaXI@Vbn@nxKnaUlnVa@Xa@VçUUla@aUK@wmULk`kIWVkLmK@V@XUln@JXV@nmbUóImUa±@@ÑóVUUk@UlKVU@akWVUUlUUaUK@UUKWbUkÅJ@XWa@XbmJ@nUJ@bUKLÝaUnk@lXbWbXnmn¦lVXnWbUbVV@VkL@VmLaWl@nb@bk@UVWak@WVImJUbUlmz@lUbkL@lVx'],
                    'encodeOffsets': [[
                            115797,
                            35089
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4109',
                'properties': {
                    'name': '濮阳市',
                    'cp': [
                        115.1917,
                        35.799
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lLXbWXXx@bVVnLllVxULUlXXlVlUnlU¦Ub¯lnK@VbVb@XbVLKVxVVnIlaba¥lU@wnalLnVVlVLXnlWVXn@@lVI@WnU@mÅW¥aW_k@WwXy@km@wUm¦lUxVLV@UwJ°x@VX@Vb@`VX@VX@llIVbnJlIbVlJ@mÑ¯Lóa@KUakX@UK@wU@lWUUÝ¯ImW¯aLUKU@k»k@mwa@UnKWI@UU@akVWKk@a±bóUWKXUmkKUmLbUx@lmLX@@bVW¦UnJkbWnXl'],
                    'encodeOffsets': [[
                            117642,
                            36501
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4111',
                'properties': {
                    'name': '漯河市',
                    'cp': [
                        113.8733,
                        33.6951
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@LUnVxnIWa@Xb@WÆIVlXaVL@VVLVbkVVUVlX@bUVkLVl@VVôU@Ò²@VbnôJVan@mWU@ImVk@WkI@wmak@wlW@w@VbnLVb°bVyXV_@aUKVVK@wUU@aK@kmbXVmJUX`knnK@aU@mwakb±@¯UUÝKUUU@WU@VkLUKU@mUmJUU@WVkL@UWJX@VVL@lVlUbLVKnêÆ'],
                    'encodeOffsets': [[
                            116348,
                            34431
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4106',
                'properties': {
                    'name': '鹤壁市',
                    'cp': [
                        114.3787,
                        35.744
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ón@xVVól@¯zJ@bkl@@kVWLUVmVXbVJnnlLl¯@Xlm°bVlWb@bKVXnJ@VV°nX@@wWVklUK@knVVKmkUKUaVkWkl»nwl°lö@lXV°UVbXKV@aJw@UmkUy¯UUUaK@UL@mm@XaÇkkmWank'],
                    'encodeOffsets': [[
                            117158,
                            36338
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/hu_bei_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '4228',
                'properties': {
                    'name': '恩施土家族苗族自治州',
                    'cp': [
                        109.5007,
                        30.2563
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VKbX@lbUVnL°@VlVnUl@VUX@aVmaXlaUUU@wmaVUn@Vnmmk@mU@knaaU¥VamX_@WUmW@_kVaVKnLl@VVal@k¥@kUW@kUKVUlUVÑW@kÇaU»ValmkUVUVak@aV¯_@WUkmVUlU@aalI@akkVWUaWXUWwWVbÆ@lalIVK@Um@UUW@al²a¯UağÇm@bkk@w@@WaULmxIUb¯@U`UXJmL¯aKXWUL@aknmK@aWUXaWm@I@UÅmVU@aUV@bVI@WkUbXkm@VakwUKULWKXmJ@XUK@mL@KUwVaUI@KU@mmnmXka@»V@@UUaw¯yVk@UUVmmkÛÈU@mWUnmxmlUbV¦UlbWVUL@UUIUmÇKVVbUVVxknLUxV`VX@kJVVUXWaUVVlUnmKUbkI@WULmK@L@LVlLnmUIWV@akn`VXUJIVlUVVbUX@¤mbnLmm@UXk@mm@Uka¥@kV@@KkU@aUKWbkLWVkIVk@UbVlmX@bU@@mmL@bn`@Ln@llVLVk@XVVU@`VXU¼k`VULka@VllVIn¤VU@@blÜbkx@bkLkKn@bn@@b@JUnV`UnVbVKlVXUlbn@°Vx@@bnVbUllVn@VVK@UnW@UVUlnkVÈÞxVbVVIxVaÆ@@aka@UVaU@@ak@Wl@nbVIÆ@Jk@L@VlXnlla@VJnw@UmwXU@aVK°ÒnllnLlbxnKVaV@l¦²nVl@llLx@XVVĶ@nax@U@alXUVaLÈþV°XxWXkK@mLnlUb@bxnLVlVVkb@UJ@xWXX'],
                    'encodeOffsets': [[
                            112816,
                            32052
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4203',
                'properties': {
                    'name': '十堰市',
                    'cp': [
                        110.5115,
                        32.3877
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@@a@w@kV@nbVK@nUla@laÅl@nlVakwWX@WkLaVmwV@anK@UlIXmWkk@@mmLkWlwk@U_mKXwWK@U¯K@UU@VUakmkIyUUVUmanU@mlwk@_mWXaUWU@Ç@U@aUaVwUKUIVkK@UWIXmaV@k@Vm@UnwlUamk@V@ULUamxUJkU@I`WkkK¯XWak@@W@IUVLWJkXkaÇVUK@kUmbmUUUKbkKWUkI@kKÝ@@aUm»nI@mU@UnWV_@aUmWbkLUl¯b@akkk@WkkJm_k@UV±@J@bnU@@WÝIUJVbXL@nlJkx@Wn@VkJmbLmU`VbUL@xVn@XV@mVVnnJVbUx@VnVUbVVx@nbUK@b@bJm²VUlbXzVJVJVbn@@Xmb@V@bVJÈ@Vnkn@°aVVV@XKnalLVmUnnVKVlnLWlXXKlk°XWkLUVVV@nU@ml¯nmbk@W`Å@mbLWm¯UxnêVèk@mbVnUK@kKmXk@@JUIlÛLllnbVnlJ@LULnlÆaVLnV@nkVJ@lkô@²bÆm°wLWV@VXKVXI@W°ÆVKb°UJVIVV¦XKVL@lInaVÝnUl@@bX@nmVL@lVLlVLVUnbVW@xXnbU°¤V@a@kWKUUn@VlnL@UV@Ü»@mX@V_akaÞ@VK¯@kkW'],
                        ['@@mUkUUm@nllVKXXVK']
                    ],
                    'encodeOffsets': [
                        [[
                                113918,
                                33739
                            ]],
                        [[
                                113817,
                                32811
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '4205',
                'properties': {
                    'name': '宜昌市',
                    'cp': [
                        111.1707,
                        30.7617
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°`U@blUbUVlVknUbV¼Èb@lXUÒkVUVVL@lVX@ll¦k@UbU@kmKULUbl@`nXV@XW`nUbV¦bmb@lV@nnlmnUm@UVnb@xVVVkbWnbVnVa@an@UaVUJXnWlXX@l¦@lKÆXbXV@VV@°¯°xXxXV@nV°UVWU_VWXkmaVnWVkn@lln@lb@UVLXWlnX@aXUmaVK@UXUU@WVIWXXVU@¥VK@UÞa²LlV@kV@UanKma@UVUnK@UVLXyVLknJ@UV@@UXKWUXaV@Vb@mVLnKWm@aUUm@@UkK@UlaLXKWaXI@alKlmUk@wVKXL@m@WWn@UVa@K@wna@aW_XWWkXbVW@k@U¯WWwka@UUaVIVkU@m±@U@@wVKka_@VV@XUVwU¥yUkm@V±ÈUKk»ÇLmmLk@ó£kmWwm@UIkWKXwWU@kLwkbmabkK@VLkmWIUKkUUÇIǫJXÅJULVÇLUV@UK@kI@WVI@UaWmXVVUL`±kÅLmKkkÅ@UaXXxWVXVbUXll@bkJb@bkVUVlnV@X'],
                    'encodeOffsets': [[
                            112906,
                            30961
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4206',
                'properties': {
                    'name': '襄樊市',
                    'cp': [
                        111.9397,
                        31.9263
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@@Xl@Xb°WlLXl_@JlVVInwVbVK@@UnlVbkmx@VUnl@U@nbWXJ@VlLUVJVLUxVb@b@VÈ@XVVWbnX@`lkx@nmVnbUVVVzlJnlVbUV@@V°L@VXLWxnLV`l@kxlXnK@nl@XlWn`Xnl@@UVa@VÈK£VLVanW°U@UVU@`VInmV@nV@Xa@aVW@UalkXKblIyÆXnlJXbl@@VV@nklU@`nVKLVKVb@VU@UÈKUVKIlUX@V`lIVbn@nblVVmV@@XXJUVV@knKVn@`@XVnKwlLVmUUU@U@aXL@WlU@UUW@UmU@KkLWaXkWmXUWm@U@nk@UmK@U@UaUVUUKV_@al@namWUI@KUK@aV@WUIb¥ULUJkImK@U@KV@U@a@UkU@K@wVaUwlU@mUULmKUkV@@anIWmUK@I¯mKkl@LUb±lUakLmk@WwUKÝVUIm`¯n@Uk@makJU_@Jma¯ImwUVkKbaUÅ@wWaU@VU@mXIVmmUkJkwm@mIlUKWzUK@VmLUV@VnbmLVbU@@lkU±KbÝV@UL@¦VWUWXUJ@XVWV@VULnbWVbW@kmWXUK@Vkam@kkm@UlmXUnbWlUXV`UX¯VmUU@Ul@Lll@nnJ@LnWmbm@b`',
                        '@@kUUm@nllVKXXVKmU'
                    ],
                    'encodeOffsets': [
                        [
                            113423,
                            32597
                        ],
                        [
                            113794,
                            32800
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '4211',
                'properties': {
                    'name': '黄冈市',
                    'cp': [
                        115.2686,
                        30.6628
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VVUnWVXnVJ@U@V@VXV@@IVJUn@V@L@KlIVlVanLVbnVlIn@@a@Kl@@IJlI@aXU@KlKkVblJXUVlU@VbVkVKXn@VlxVa²I@VlVUxln@bJXklaVWnLmÅ@y@k@aI@W@aXIlVVaV@nnlKnLVW@IUa@a@KUVVlI@wXKVV@IUla@lUXwWnnalLlxXLll°@XwVKVaXIlnb@nln@Va@U@k°UmÆUVaXIJV¯ÇUmmkU@WaKmakVm@U@aVKkkmKkVmIkÇ°£@aUUVaVVnKlkXmk@lUVaX@@Um@UmlUXVUVU@wK²¥Ua@I@UVl@UV±UIUÇ°»VkUmVI@a@Umĉ¯V±bŹĖğaÇL¯lmkX@óĀ@mÝêb±WkLn@xXx@@b@V@LW@UblţX`kxWnXô¯¦ÆV@L@JVLxkK@V@bkz°llXz@JUlVla@XUVbVKXnW`XXV@laVV@VX@V¯xx@xULVbUJ@n@LU@VmmakbUK@bIWWUUVkUmkLm@VJkb@nUJ@`V@kXaUaVmmLkUmJ@Uk@U±lkzmJUb@bVUxVXU¤L@JX@VlL@JkLUVU@mnUl¦@V'],
                    'encodeOffsets': [[
                            117181,
                            32063
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4210',
                'properties': {
                    'name': '荆州市',
                    'cp': [
                        113.291,
                        30.0092
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÈJVlVVLXJlnK@UlLanblaxlK@XVWxXLlJ@VnXxlnô¤l@nKnÈKl¼VL²ÇUn@VlzV¦UxWVU@@U`lbUL@xV@²@@nlVUUJVb@VlbXx°XVWX_VKUwVKVa@UVKUUVk@KnblaUU@wnWl@UX@lÆ@@aIVmUkxVJUbÜ@Uk@WWnk@VVm@I@m@Un@mXUlVlUnJ@knJVU°@@aÆLX@llL@¦nJV@XblLVa²U@UlW@VX@`@LV@@bXJlIXml_lJU°bKÆLnVVl@öVmXaVIĢllUlVnLVlX@@bannxVLbn@°ÆXmmkĉ¯w±Uċ@KÝÅƧŃÝçUw¯m¯k@WkV@¯UIUJW¼kbUwk@W`@¦Uônb@VÆlÈ@VU@£UWWnUÆUnmJkUÇ£VWUI@aUU@WkI@Ua@JW@k£kaWVUKmnkKbkkVWbVmUUmwU@kk@UakUUa@V@nlx@lUb±lUbnnWLUyk@UamUK@mlk@Wb@VXL@x@xWI@a¯¯V@bVn@LkKmL@`XmKmVU@@bkL@V±bk@UaaLKUVIWXamVVbUK@b@Lm@UWkxULWVUnm@UlUX'],
                    'encodeOffsets': [[
                            113918,
                            30764
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4208',
                'properties': {
                    'name': '荆门市',
                    'cp': [
                        112.6758,
                        30.9979
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@lxlInVUnWJ@nUVV@Xb@xVÆbalLVUnx°JnbI@V`lInbl@@V°mn_VJÞUVLXx@nllKVb²kVa@KlknL°@JVLXnmJ@bU@VlnLVKV@nX@lUKVaXal@VKn@¥°L@UnwbnaV@KV@VUX@lVXI@KW@@IXWV@laVLKlaXUVVnkVWV@lwXblIXWVkVmaU£VaUmVIkU@y@WakKUamU@UUK@kmK@w@@mK@LV¯U@WwkmULamVVUU@IbUKUakmm@UakLmxU@UÒWlULţÿmwkIUm@akÈblW@UVUUk@JW@XkWWUkUKUIlw@aUWknWUUmnIWaUwVaÛaVUIwVlUnJ@bÅ@@kVWk@mX@xVVkbma@LUlVVUL@VUbULVxULW`UX@V@lUXWaXlWXX`@bmb@x@LUb@VmXX@@nWKUL@xVlknkL@bWJXbWLKkb@VlL@Vn@VV@bnXmLUK@nUaU@WbXVWL@VU@@V'],
                    'encodeOffsets': [[
                            114548,
                            31984
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4212',
                'properties': {
                    'name': '咸宁市',
                    'cp': [
                        114.2578,
                        29.6631
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÞÆLČ@V²°xĊnlWnÅ¯m@aK@°nJwnVIUaÆJÅ@wwVXW@aV_l@²V°lĊwlaXLwlUkalVVaX@lVXI@aUXJ@U°UU¥VIVKVklanLVa@VÈIVV@nk@aVa@mV_@aK@klKUa@UnKWk@@lU@@UW@@nUWUwmaVIXlV@mLXblJ@kV@kk@KU@WkUWVÅwkLmW@UmL@lULKULak@maUUÝwUJIbKUU@aWK@kUWVkUwVw@mÝ@I@wkW@aww@LU¥kJ@nVJIkVVnkVUkyUIUl@xWUkaW@@°kzWxkLUWmzk@@bVVVb@@XlV@Vl@bVbUn`Wn@WbVVI@`LVbXLV`mnU@@lL@LUak@Lk@WbUJn¦@lVb@xVb@n'],
                    'encodeOffsets': [[
                            116303,
                            30567
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4213',
                'properties': {
                    'name': '随州市',
                    'cp': [
                        113.4338,
                        31.8768
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@n`lwkUmUVWX@lk@VanUĠ¼V@@mX@@nVVVXLmJVLnK@bV@@J@VUn@VaVUUUVWVLV@@Kk_@almaVkUU@WVVUVLXmmk@wUaUKUV@°@kmaUaÈmWmUVklaX@lVnxl@@UnaUk@VUVwVKn@VVn@VbVJUknUmmVmk_VwKUUmVak¥@UVKVIkW@UmIVWkIVkmmLkwmVU@LUU@VVXL@JmLUbmK@UUKmkKUUmVUaUnÇlk¯mJUnmLUaUJUaWL@UkJU@aklkU@¯@KWLUmUUWVkbLUKkbU@WX@JX@@LWJkUW@UVU@@LUmbamx@V¯K@¦mULk@WbUbLkVW@kVVxUb@x@LlV@V@b@VU@L@VLnlJVIVK¦aVJ@XU@bLV@LVJnXmbk@@bU`VLUVVb@V@VnL@Vml@@VXnWVXnWlXblK@LnV@VVX@VkV@XWK@bVV@VV'],
                    'encodeOffsets': [[
                            115830,
                            33154
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4209',
                'properties': {
                    'name': '孝感市',
                    'cp': [
                        113.9502,
                        31.1188
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VnXK@L@°lVlkb@VlI@VXKVbVIVbnKVmnI°lÈkVmVbnUVVlLnVL@VnLVanK@IWKUUV@V@KVnUlxnKlnUlJUXnJ@VlXUJUL@Vl¦UbnVVLUxl`UnnnmVVlnVKbmVX@a°Ý°LaXJV@VUnKVXVK@LnKlLUbVVX@VwVJVn@@UU¥V@@UUK@maUVUkkJ@L@K@UmVUI@JU@W@U@UV@UIWmXUVmUUÇ@UVmIlmnmakK@akaW@UwVUkKVnUlKVwkVU_WKUkVW@UXaWkUa@w@VU@XaW±@IkbKb¯L@WXkW@UakL@UV@UmVUmL@UXWVL@aUVUUUVU@yUUIUa@wUKWVU@kWk¯UkwVKLUxK@nVxUlUUWVUmw@wUUyXWlX¦WbUV@U@blbUVVbXXl@lVL@bk@lxkVVnVx¦`UnkL@V@L@@@xnL@lVL@VnVVblLXb@@zlVUJVnUbV¤bUnUlWXkJWakxU@UXml'],
                    'encodeOffsets': [[
                            116033,
                            32091
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4201',
                'properties': {
                    'name': '武汉市',
                    'cp': [
                        114.3896,
                        30.6628
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nbnmknJVUÈ@@U¥VknmV@VUlK@IkK@UW@IKV£UWVwU@aVanIly²kVl@@VnIlVnKUnVbblWU@@_VI@mlaUIn@lKVnUlVVXXJ@aVLlanbUnV@@K@mVIUaVK@ww°w@UW@UUUkbU@WWX_WmULaVU@WkbkUV@IWyk¯kly@a@UlLwUK@I@KÅUW@Å±Um@wl¥ka@@_Vw@ķa@akw@kKW£XVUVwVwUaU@VUUxWKkbĉx¯k±Uk@U`@bWXUx@xÆÅIVbUJmxIm¯@UmxnUVVbnJV@L@@kV@bVn@UVULlx°VXllV@XUVL@xVbJVV@zUVVVUVV@bUKWX@VnKUVVnU@@VlKVb@lXW@X°KaLla@JX²Wb@UV@@xVbXlWb@VUXVlXLV`UlUxkLmVUlLUVVxX@lb@blL'],
                    'encodeOffsets': [[
                            117000,
                            32097
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4202',
                'properties': {
                    'name': '黄石市',
                    'cp': [
                        115.0159,
                        29.9213
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VUVV@VbUxaWUblUVmnKlX@bXJVIlVUxVVVIUzlx¯@VbnL@xx@UVaXKb@XkWU_Vm²klWXVKl@nXV@@wmlK²XaÞén@ôÿ@lWn°kUKmmUÑUmm@wkImWU@UakL@bVLUVċ@bUK@alIXKWK@nXnKmkUVw@¯b@LlUL±Wn@KULUaW@kL@lL@bU`@nUb@bmlU@UÇJ@UUbmKkblUULUJV¦¯V@VWIV@bWJkUW@UbkUlbkV'],
                    'encodeOffsets': [[
                            117282,
                            30685
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '429021',
                'properties': {
                    'name': '神农架林区',
                    'cp': [
                        110.4565,
                        31.5802
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n`lIXll@ll@b°aVklKXaVn@bU`mX@VV@nmJn¼V@bÞ@lL@lJXVlLaVLVnVnalV@VLÈUlblWXIKVU@J_@annaXm@KmI@mkk@KVkWWw¯w¯°@UUU@WaÅWkL@¥@kWWXkWmIUVVbm@@bUbmUUbW@UVk@mVkU@U¯mKVUkaW@aULÆVbb@VÅ@Un@VLWl¯L'],
                    'encodeOffsets': [[
                            112624,
                            32266
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '429006',
                'properties': {
                    'name': '天门市',
                    'cp': [
                        113.0273,
                        30.6409
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@K@UlKVm_¥UwUmlUkwl@@aUK@kkWWUaVUka@aV@VUXaW¥Xk@WWIklm@ÅxmIVÝUkxka@bWJaUL@W@l¯UULUbkVUa¯bm¤UnÇUkmUUxb@VkXÇal@bVnlJnxŤĀVKXkVÑV@nwlKVbn@nlVbVLaJ@VVUnUbVKlnXxV@°U@KnL'],
                    'encodeOffsets': [[
                            116056,
                            31636
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '429004',
                'properties': {
                    'name': '仙桃市',
                    'cp': [
                        113.3789,
                        30.3003
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VK°VkX@@VKbXI@alblwÞVUnJÆwn@lkXJ@XWVzV@xnxVXUVVVkUw@mLVwKVU@Um@alU@@@KUmIUaVUmnwmwmb@aW@UkmKkUkVġkUJWbnUõ@UkmUÅKL¯aVkIk`WnkJ@xVLUVVbUbk@WlXbmVxnxUblbUV@@VUV@nVL'],
                    'encodeOffsets': [[
                            115662,
                            31259
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '429005',
                'properties': {
                    'name': '潜江市',
                    'cp': [
                        112.7637,
                        30.3607
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@UbVxbXmJVnXVlmVX@bkxVJVLVlXXWlX@@IVlVUaVwVlnÈVVmn£°aVbUlaVUK@mVU@U@VUkaVamwUwnWaXkl@VaUaVUUK@wWI@aU@@K@_UW@kX@V±VUbkKWaU@mI@¥kKkW@ÅK@b¯@UVmI@lmIkVkUWVnm@@V@n@JUnU@mlXXl@@V'],
                    'encodeOffsets': [[
                            115234,
                            31118
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4207',
                'properties': {
                    'name': '鄂州市',
                    'cp': [
                        114.7302,
                        30.4102
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°¥WóXmlw_ŤWkVaX@@K@U@a@WwU@mWk@ULWkX±lUnV`XWl@aWLUb@Vw@wmKUa@°kwyVUJUUVwkUUJWI@akWmLUnkVaXVbUxUVWX¤lL@lx@bb@ĸUx@`@lbk¦@xn²VÆX@'],
                    'encodeOffsets': [[
                            117541,
                            31349
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/hu_nan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '4312',
                'properties': {
                    'name': '怀化市',
                    'cp': [
                        109.9512,
                        27.4438
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@@n@b@XnJ@k°x@aVUnlUXnV@@VnJWUJVnIVV°UbVVVL@²LUVa°V@aV@nmUXblLXWVXVmVLVK@an_`@X@l°VlXXW`nX@Jmn@b@nV@Lm`bUbn@VUVl@nIVbUlV@LkJUnVV@xVblVUbU@zUKU@mx@xUnn@@WV@lbUb@nVWXXV@VIV@VUnJ@VUz@JWbXllI@VXVVL@Vn@Wlb@lXVlLaV@VJ@XX`kVwVl@bkbUlVXIlnLVamVwV@@nV@XaVJVbX@lwV@n@nV@VWnIVVUÆ@Xxa@IUUKmk@mVIXmWUVJnUVU@anaVwkU@UXa@W@m_@a¯@@K@UVbnK@blIlbXa@WW_n@VU@¯bmyUkUJÇÅ@WU@kWKÅwnm°KVkmankVWnXVWV@UwXkV@mUlLnaVaX@VUn@VnVK@xlnXWU@a@@klakVwmUaV@wmIÛ`m@mVUXmlIXVI@K@aU@UaV_UK@wkUmmUKWXmVkUL@mU_nK@aVU@Ukak»@U@ymU¯UUVKkam@nka@mwkLWb¯mka_VaVKUIUw@kKmU@WK@UnmaULkU@wUalWV¹U@@WUI@WU@_@W@U@mU@WbbUK@Um@@UmbUwWWkk@WUa@anUUwlWUwUU@wlJVUnnV@@mnI@mK@U@wa@wUm@_mVUUaVUk_kċUkVWL@mlU@kn¥W@UwUWV@VÝU@lXLWVUbVLXlVIlknmU@VUJk@@@kVmwmVkxU@@XmVUb@xnKVLl@VxUxkIU`@bWVXX@JWL@bkb¤@bmUUU¯Kkmb@VVUVVn@@Vb@`lnxmblUnbk@xUmV@bmWbUV@VJIl@nVUbK@nn@VbnJVIlJVkXJ@X@lmx@bnnWVXJWXU@UlU@mk@@llb°xIUbnJ@VWbXVmI@JVX@bk@bWL@JUXUK@U@U`n@@Xm@XVW@@nX@@`ImxU@@JUI@KLmK@UÅUUV@VW@¯kUU@UamVUUmJ@nxmLKkmJkwkKm_mKXU@aU@b@Wk@ma@zUJVUmbUlU@xnXlWlXXblK¤V@@nUVVLkVl@Xb@VVKnXKVx@znW@X@@lVK@X@JXbWbnn@JUamLVVXIVxnK@aWUX@x@VnI@WlI@anVIVxkl@lbXXxVVVJVInbV@@ln¦ml@XXVWbkJWb',
                        '@@XLVKVXVKUa@UUUmV@l'
                    ],
                    'encodeOffsets': [
                        [
                            112050,
                            28384
                        ],
                        [
                            112174,
                            27394
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '4311',
                'properties': {
                    'name': '永州市',
                    'cp': [
                        111.709,
                        25.752
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lxUXVlXUVnlVĢJVbUXVJV@XUW¯VIUK@klW@Un@nl@V`XUVL@l@Vx@XXW`UnUbxUlVnUVlb@VnJUVVVInJlUVnwVklKnwLVJVV@nIV@nbVa@KVVVUUaKV_nVVJ@_VWnV@n¥lI@anl¥X_VKlwVlULUVVV@U@VXL@IUmn@VU@wmKXUWU@m²l@VIXWWkWUkWlkIVamUXamUnmWUU@@UnlK@XJl@kVUk@mWKXkl@@aVU@UVWUUVaIn`VUVLnw@U@K@U@w@UVmUU°K@UnV@bV@Xk@KVm@amkaU£VWUUmUUwm`UbULkaKXU@kVmU@aV_UWVIn@yXXK@klmVV_kWVUn@WUU@UmaU@wnwWanUmmXkam@UakLmK@bxUUUU@Km¥Va¯@kUaVUlmUU@mUUÇmUkUybbUaXUWWbÅLmL@VaL@WWXUKmmk@a@UUKXW¥kU@VUkxmVkUWbUJnVJ@nVJXzWxk@lVbUX@VVL@`mbUnUnVV¼k@Ulm@mwLb@lmLUK@UamWkK@£Ua@UkJkUmbVlkX@bWbUVnnUVl@bbVK@VX@lbV@nU¤x²Knblb@xVô@l@b@l@XWxnVl@VV@XLVlLUUXV`bXXmJU@@bm@UUkLW@UlUKWUUbwUmL@nklVVmVXXm@@bUKlÆnXkllVUVVL@nUbV@V@nnV@xUn¯U@JW@UX@xĉ@`m@@LV@b'],
                    'encodeOffsets': [[
                            113671,
                            26989
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4305',
                'properties': {
                    'name': '邵阳市',
                    'cp': [
                        110.9619,
                        26.8121
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XIlJIVVK@n@VVVKnLVwVmnLVK@U@wJ@wVIÆ°X@ÜÈUÈxll@kn@VwVaXJWXn@@WVL@UUKVKV_U@@aVKx@UaV@lk@XylbUaV_Vnal@WU@aI@aV@@aVUl@XmUXWaXml@@kk@ma@V_UnUVUUWJUa@kkaWLUmk@@LUVWUkJWkK@¼UnWJIkV@b@JUIm@UlVm@Uw@a@kWXWKUknW@WUU@kmxUkVmIUJUUVmI@UkaUVUmVkwVaVmX_WW@Uw@@kUKWVU_k@mm@@VkX@lVLUJX°WVU@UIVWUaIUġmkVUkWUVWkwWXk`mI@¥kUVUUn±@mXkWknVUVmmU@@XVUk`@Xk@¥¯»mbĉó@mkU@kUKmX@UnmL@lULkKUWUU@bUaUn@Vb@l¦Ub@l@UKmnKUnlUVVbUVn@`Vn@xb@x@VL@nmJ@nU@mmUVkI@xVVVxkXVxmV@bbXVl@XlXVxna@Vn@@VVLaXaV@n@@V@X`V@@XVJ@XV@UºkXVb@xlVVKnbm@VXLV@nlL@VxJVULUb`lb°nXalKnx@lbmn@lbULVV°nV@z@Vl¼lb@VUV@bmLV`@nKlVnUXWVLnnlV@xVLU`VbV@'],
                    'encodeOffsets': [[
                            113535,
                            28322
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4310',
                'properties': {
                    'name': '郴州市',
                    'cp': [
                        113.2361,
                        25.8673
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²zVaVlnVl@nVkJl_XJlIVmnL@mV@VXn@lV@XzV@lyV¯²U@UlJ@XVKnVVIXl@UVLV`@n@JI@mlIKVLnUlVUVVLXaKVLl@nb@WXV°KUnVVL@xVJL@b@LUVVVUVXbmbVbn@@lUbm@x@XVVV@@@bkImx@Vm@Xbb@l°XU¤aLmnL@bl@@VUX@VxnVanLnW¥XKVwnUWXmVIUWÆLVxLw@wVmlU@¥XWUkwlÇn_UwWV@VU°wnUy@aVkVlnL@lVnw@VlJ@bXx@bVKnb@U@WVUl@@Vnbl@XLlK@aVLVKnxÞn@aLlmUaVUm@ÅknUmaUKmVk@mkk@UlWUkVm@w@kUU@WU¯¥@wÇ@aVIlUV@kUWU@UUm»@k@mKVkUKUwaUaUa@kkUWJkImaU@UK@maUzk`@zy@XmJkL@UUJmUkV@z@kkVmK@¦UbWL@a@UbmKmwUKXkVUUkmVkw@UUKmL@WUIWaJW_k@@WmI@mk@WkWULUUVKUUVm@Ub@nUÇ@U@wV@Ua@aL@akl@kUJwó@@L@V@`@J@xnnmV@bkJmUó@nJWUUmU@UV@LkWlnnmVXbmxxV@nbVV@XVm@UVlXU`Ukn@lWLWzm@UJVXU`@bVUn@lWVLlbVKVan_VxnVVVUXV¤bnl@bUn@LWlU@@amU@V¯LVVUn@V@x@V@L@VmxUKUVm_JUbVV'],
                    'encodeOffsets': [[
                            114930,
                            26747
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4307',
                'properties': {
                    'name': '常德市',
                    'cp': [
                        111.4014,
                        29.2676
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lUmkUwUyV@VW@¯VaVmUU@KVUVUVLnaWnkUÓV_@mVU@Ýw@ka@kVmUmK@IkaUamKkXWaUW@WUk@@KVU@aU@L@J@XÇVUKVak_mWkLWakVUbmLUUmlUVKUU@kUWW@UImJ@xkLkKm@@X@óÝ@UUk@UKVULKXkWWbkaIUWU@mUk@WLaUJġ@@XÈÆVIlVnz°aV@Um@X`@XWbkakJ@amLaU@V@L°@@bn`@@XWb@VVlUxmb@bUVmVUIXVWnJU@nnlVLV@JbWzk`m@UVK²VxkLVl@Vn@V°xVKVkVVlUblx@bUÆ@@nVnUllkx@VW@@VkLWxUL@bÝ@kKkVõV@bkXVVUV@VkUkVLkVa@@¯xUxmX@JVb°WXkK@Vm@kVbbn¤xUXkJblxnXÆK²l_@Wnan@UL@bJnIlV@lU@@¯ô@lWȂIVKVmU@aXaV@lwVXn@@K@UVKUUnUbn@lWXlJnULKV@l@²a@UlK@aV@naVXWV_nKlL@KUm@a°U°@VXL@a@wWmXal@k@VLnV@@bl@VnX@mwVa²aVU@mk@'],
                    'encodeOffsets': [[
                            114976,
                            30201
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4331',
                'properties': {
                    'name': '湘西土家族苗族自治州',
                    'cp': [
                        109.7864,
                        28.6743
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@KL@wnK±nnm@WUkÜÈn@n»@mVamkmUl@VnmmU@wUan¯VKLnVWlInyWUI@WWk@KXUn@mnUmU@WmkV@kXaaVaUmIk@kaX@Um@UKWU@UkJWkXa@IVy@UmIUVU@UJU@WXWmU@VakaU@@Xm@Vm@wnwV@VLyV@VakUUa@wUUVmlI@KUVkUamJk@VU@UmVaan_@KmU@@anm@ImWX_WWUk¯@k@W_m`@bULUKUnUWWXkKWaVmnU@@b¯UUbV±K@UKUUVa¯UUmJUVIXmI@UU@WmVmkUV@b¯w@lmI@W@a@m¯LXbmJVLklWL@V@XXmbVVU@@VU²Ul@VlX@b`XxzUmkUVÒl@bXLWxXVl@VbkLma@nmVmULVbmVUb@lnzmbUÒVl@°nLVlJkn@bmJk_VmmkblxÈx@LUbxVb@Vn@JmLVU@nV@¦VbnJ@lVVbkxbm@UxVLV@n`UnVVVkl°zxVb@VU@@ÆlXnWm¦nbVK@XVVUVVl@XKUV@nVL@WnIWXLVKVLlxUbVKXVWbn@@UnKVLVbJU@aVU°b'],
                    'encodeOffsets': [[
                            112354,
                            30325
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4304',
                'properties': {
                    'name': '衡阳市',
                    'cp': [
                        112.4121,
                        26.7902
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lV@XV@mXVlXLWX@l@bVxn@UVkn@VJ@I@alUJXIVm@»LXllIXVVU@Kl@VnXKlb@lVbXIVVUmVVU`@nbl@@lXLVVVKVbnXWJ@VXbWxXbUlVK¦nLVVUVVbbK@ULnK@Un@VxlUV`UnnL@VVL@JV@VUnxnKVbV@@VIVUnJUVUl@nWXllIUaKVbÞLV¼²`V@VIUwlaVmXa@IWanK@U@mkVVUVaX@lnaVLÈ@¥@kkJUWJUaXkaUmwVXJ@_lWUU@¥n_KkamUK@amKnKbV£¯W@kaWan@@UnwlJ@a@@UUU@Wwn@Va@km@UanaWaUVUUVU@K@aKUI@wKUUVm¯LWUX@mak@UKLWbUKVUkUmVUKLkJ@nJ@I@mU_UK@VWkUJmUUL@WkI@V±VU°kzU@Wy@kUm@UWU@@nmKUnkJWIk`IUlmk@mUUkUb±yUX@VUV@bk@WlXL@nVlUlk@WI@kLm@VV@XVmnnVWbnVUblJXkVlXXlWXUJk@±@nXVWVnL@xUVm@Vn@JWK@UV@UUVUVKUkkxULW`k¦m@bkJm¦U@mUX@`UImUU`LVbUVUU@LUbmaU@mJU@UUIKmxkLUl'],
                    'encodeOffsets': [[
                            114222,
                            27484
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4306',
                'properties': {
                    'name': '岳阳市',
                    'cp': [
                        113.2361,
                        29.1357
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@wUklmUUmU@@UVm@wUaV_mmUKmwkIkJmUUnm@@UUbUKUmÛamm¯xVLkbÇÆUVUzkVUlUUKWLX¦W@VUUUaKUbmLKm@akU@amVaUUVIVWkk@wk@@xmLlmÅwmbVlXlÝIWVkK@kkVL@VWKU@Ublnam@b@bnW`@XUJk@UUWKk@UKnn@xmLUVm@kbVbVnV@Vb@KnVLWXÆVĢ¦VblnUJWz@ÆVóUVbkVaÅx@¦lVUbVVknWKk@wKVUÅl@zkb@`m_mJ@xXmbVb@llV@n@llbXLUXalUlalVnwnLVKlVbX@@IV@blJ@bVL@VVVUXÈ¤VnkVÑXmlbnVKkÑÅ@UmaVç@±XUlIxlV@VaX¯lUVVUVJnV@°°n°Vxĸł°¦b²¦lJ@U@aUK@kUm@_m±VIXal@Kl@bV@KK@km@UmUUaK@_UJaXU@Xm_VmUk@WUk@kU@a@m@UaUUU@al@nyXXWWwkly@¯n@@bnV@k@mVIVlUUmlUJUwIbXVaUal@Kb@VKVkXVl@VkUU@ylUVVaVL'],
                    'encodeOffsets': [[
                            116888,
                            29526
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4309',
                'properties': {
                    'name': '益阳市',
                    'cp': [
                        111.731,
                        28.3832
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÆxXL@lV@ĢVIbXKl@nVV@XVJlbXalXWLVKUVLl@VV@ôÞ@@Wn@lLlK@wnIVJX@VX@lVVULVnkVVnKValUXblKnXl`UbVLÈU@W@IKV@@bUV@L@lXV@VXXblWnLVblb@JnLVUn@llb@x@ÞUV@nU`VÔmlXmbUKUVUV@LVVUnUb@°UX@UVzVxnlVkVnlVnaW@wnIn`@_la@ykÆVULxl@XLlmUUVakU@¥ÆwblUUaôVU@ÅXyVImkUaġ¥ÅUWXKmU@La@UmUUUalan@VUnK@wmmL@VlXLVVl@VI@WX_m@a¯mKUkwW¥UK@_UWWLUVkUWL@WUIkVU@JwkLUUmJVI@WkXm@VmkKUIU@mmm_@VUV@kJċwUU@KUWkkW@IWW@km@klwkWVkkUV¯m@kWLU`mIkmkXm@@`@L@xUKWkU@VL@JUU@mbUKVa¯WVnL@`lXUVkU@xW@UbUWVU@UJ@lnU@mnÈmVa@bULwUb@@VkxmUUUVK@IUmk@akm@wmIkK@bVWXkm@wULUmm@UVW@UbmbkKVnU@WlxVU@UXmWUXmlnbUl¯Lmn'],
                    'encodeOffsets': [[
                            113378,
                            28981
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4301',
                'properties': {
                    'name': '长沙市',
                    'cp': [
                        113.0823,
                        28.2568
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lVUllXkx@lln@XX@JlXXlV@LVVČxlI@VU@Un`nnV@VJlLUnn@lW@XUJnIVVlKx@IVlUVJ@XXKlVVUXKVX@`VLX¦lxVnL°an@bkmVaV@XL@UKlU@llLXUÞJWkUknaÆxnknK@w@l@xllUXUJVVUbn@blV@bnLnKVaLVbVVUX@W¥XKVLVVklUVyUVÈÅlaUK°wnnÜbnVVLaVV@n@VmnVlIlJna@Valkn@na@amwm@UXwK@aUUVUUaVawWK@kU@UaW@kKUU@kW¯XWan@kmmÅ@@I@U@KmLkaVUKkLWVUk@UVmU@am@kkk¥UVUKmaUb@UbI@aKkkWm@W¯K¯b@VmaULVxUXlVk@UxVJVbUb@xUL@ULWWLĕmxVVL@VbKUwaÅ²WwX@@WUWLU@VbkV@aU@@VUnmJ@VUn@VLUK@UmUIk@UÇmU@@UW@J@LbUmVI@aUmW@@bkXUx@lmLUbm@UbkJ@V@XmlUbkKm@ma@kUaVU@aUK@mImJUIkVUVUakbWwka@UWKkLUamKUXm`Å_UULmaU@@lUV@X'],
                    'encodeOffsets': [[
                            114582,
                            28694
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4302',
                'properties': {
                    'name': '株洲市',
                    'cp': [
                        113.5327,
                        27.0319
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XUnwĖKXXVK@VK@wVaUaUIVwl@kUVWUwVKnb@U°a°LX@XnllL@bJVa@VanbVLUV@al@@UV¯ÅÇ@Ummkw@¯yVwnUVVVUkmWVnKVUa@WXkVKn@lUVUVVVXIlV°VnI@VlKnV@mwVm@LXKWkU¥wWw@k@mX@KX¯V@VUVa@VnKWkV@VUkm@aWa@wkUWwkmV£VÿXUVL@mVIXaò@nW@aU@@am@aUUUmXmWUk@nUW@_maVmwUkamaUL@awW@akI@UxUm@kmKUklU@bzVm¯xUVU@XVxm`kÈlxXVW@¦kVUn@xxKUwÅKVXUJWnXmVUxWL¦XmmKbmUUwW@UV@k@VLnlbLm`@¦VVkX@`WIUxVnlbWVbXIVlI@l¦Ç@UKmbkW@UbUVUl@n@VmLXb@JWbUnkbVxUJUxWXXlWL@V@V@XXJWxzUVVVVKnXW`@bkIUlnLVJUbUIWVXlWV@XklVbnn@xl'],
                    'encodeOffsets': [[
                            115774,
                            28587
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4308',
                'properties': {
                    'name': '张家界市',
                    'cp': [
                        110.5115,
                        29.328
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@InWVw°w@@blUKlUlVU@VUUUlW@aöUlUlLÞ@@aVKXwlK@UX@@UlwkVkUm@m@ÅV@akwVaUkUUlUL¯w@UUm@UkKlw±UULVn@l_XyWwÅ@VUUmJUXU@@mmU@kxW@UaUIWbU@@mU@UxnUbmKkWJkUVal@aUkUxlW_@WUIU@bkKWUJVnUbbWblU@nl@XnVmV@nmWV@LXl@XJXVmzkJUXmKULm°Vb@xnVmnUk@VnnlUb@nm¼m@ÛÇVl@Xmnm²mL@xK@LUl@nULÆx@V@VXVWbXXl@nLlm@bVKXWL°bnU@VaVU@mVwJnwVK°zn@VVba@Ċ¼'],
                    'encodeOffsets': [[
                            113288,
                            30471
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4313',
                'properties': {
                    'name': '娄底市',
                    'cp': [
                        111.6431,
                        27.7185
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lLnJ@xln@bnlV@JLVUVnVlw@U@VaxVK@abnUmÇnV@km@I@VUVVXVaX@@wlVVUkW@_mKXU°UbVLnaV@V@IUKV@XlVL@w@K@_n@lWlnnJV_XK@l°nU@WVU@kV@nbVKVl@nLlLXU@lmkw@nW@UKVa¯IVn@@aVUUKl@nXVKVn²aXblKnLlmVI@KUU@akLUaVaUXm@a@wVUVKnLnWlXln@@U@anUVm@UInm@IUK@UmKVmU_kVUwm@@VmLK@VLaUaVUUUmK¥ULkVWaXwWa@UXImWUaULUUWKk@WnXbWVWnk@UV@bU@@bJ@bV@XkmbUU`VbkaWz@klU@b@VwUL@bV@U`ULVL@VUK@Xm@XWWIUbUxm@@lkkÇwVÛÇW@¯ÅUJ@xIx@@VULmKUnUxmKULUUm@@ULUJkIWJ@b@LJUWkJWnUV@nnÜ_nJxU@VbnUxlkb@l@'],
                    'encodeOffsets': [[
                            113682,
                            28699
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '4303',
                'properties': {
                    'name': '湘潭市',
                    'cp': [
                        112.5439,
                        27.7075
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Æ`n_VWnLVblKXL@VlbXxlaVbUVlUVJnInJ@VL@bUVVb@lnbn@lLVank@W@UlIVan@VanK@kVwlW@aX@Vn@bUJVna@KIX@@VV@nVÈl@VJn@VVLK@UVm@UnIVm@UV@@blUUaV@XKV@XW@XxÆ±bVxLUa@UKWk@wmmUalk@WXUWkXUVJVaUImKVklJ@aX_mWULUUVUyXwWI@W@U@UXKWkXWVwU@±_U»ÝKUaLVbkJkWmXk@UVVmIUVJ@UU@UamLmwUVU@mnJ@VUnmV@b@Vm@kkWmXmKULUV@x@bWnVUbVblK@bVV@LUJknmKkLWa±bUmULmWk@VLUV@bm@U°JUbVLX@@mlxkn@WVKkmK@k'],
                    'encodeOffsets': [[
                            114683,
                            28576
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/jiang_su_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3209',
                'properties': {
                    'name': '盐城市',
                    'cp': [
                        120.2234,
                        33.5577
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@°ĀÞ°@¦ULWKkx@bkLWb@lUlVXXJVbnUKmxXV@bm@@XLÞÜ¦XlVnmzVJ@n@²ÞôkÆÞaȰĉwnǉÜóéVÛnĊīČǉĉ@ō@KÞUlU@kklÇÈÑÑlġXɛ@UġaU@U_W@n@kaUL@VW@kKmkUV@bkbWW@bkzma@JWI@KUKUL@U¦`@XUJU@KmXw¯KXkmy@aUIWJXXmV@K¯UU@@bVL@¤VLXbV@@JVXVK@JVn@bkKmakVVXUVVVlI@`U@nzVVb@¤n@@UlKXLVVI@V@nV@V@ÈUx@óVōkÅWó@mU@bk@Ýwk@WbXxm@@J@zV@kVbVnLWVUXWUXUWLU@Wl°z@VkxU@UVWIxWJkbĬnW@@bUl'],
                    'encodeOffsets': [[
                            122344,
                            34504
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3203',
                'properties': {
                    'name': '徐州市',
                    'cp': [
                        117.5208,
                        34.3268
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XKVX@WnIVx@K°Lnll@@I°KnVaU°x²mlx@VanU@ak@akmV@@w@Ua@aUwVwUw@w@UK@£kaĉlóIÇVk±@@kUKmVkIkxW@Ua¯UUm@UVI@WVIJV@@Um@UanaU@mI@J@XV@XaVlkXVaUUWLUyVIXmWak@XkJókJUL@KWkk@ULU@WalUIkJmImkVbV@lV°kXUKWKULUmb@VUlVnb@VV@IVKUUmU@ak@@bmV@xklUU@UKmV@nJVbkXKUamLUJ¯UUVmIbVVLl`@LLU`m@kXUVU@VlxUK@xkIWbUKx@VkVVnb¯@@U@xkmbkLÇKb@@XnJ@LmVkl@@XlUVkxakVVb@bVnUbU@@xVUVb@nIĊ`XVVôJ_K@xlU²KlkU@VaVVÈm@kVUVmnamUUaVXIVJ@ç@¥nkVLn@@XVK@VUX@JVUV@UnVJVLUJVLUVlnIbKnU@m°VanI@anVKVLanlKblKÞk@¦@¤@VKnLVKLKVzlWLX@VmV@VbnU°@UalkWXLVUKWkUUW@£Wa'],
                    'encodeOffsets': [[
                            121005,
                            35213
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3206',
                'properties': {
                    'name': '南通市',
                    'cp': [
                        121.1023,
                        32.1625
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VJ@bnzWl°LxnW@LVVI@W_V¥@VKVL@LXJI@nbly@aXXla@aVUnllLX@@UVKlb@@mXV`V@bĢlkČÇÆȘ¯wnĕVĉVÿUƒUĠŦğlXÑVǵ@±ōLʵĖ¯lÇbÝÞ¯xk@Çkķén¯@ğġƴǫ@kVVlUbL@xULÇóLUl¤@nkVV°VLkxVb@laUXUKWĖklVX@¤UUkb'],
                    'encodeOffsets': [[
                            123087,
                            33385
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3208',
                'properties': {
                    'name': '淮安市',
                    'cp': [
                        118.927,
                        33.4039
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nźUôÒɴèl¦nĖVkbmX@xVlVL@xUb@bUJVnUxlKVLÈxmzXV@lW@XVb@bÈVxnbVIXa°LaÆVVaXUlK@aXIÆVlXKVUlIXalK@alwXLVK@¥Ý¯¯ÿ@mVk@aX@mīlaXIwXJVUV@lw@U¯ybUaUġUÅaUKVknaġm@kUm@wÆIV±nLÆwÇnUUk@ƅÝU¯JÝI¯¦Ul@b@@VVL@l@LLÅmL@b@UaVaUWmLUKV¹KLWKX¥WI@mXk@UmaUVUU@VmL@WbkIUWUmVóIkbmm@UbVLUxmJkU@bkJWbnXU`WzKUÞÈlVbLmx@kè@Æ'],
                    'encodeOffsets': [[
                            121062,
                            33975
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3205',
                'properties': {
                    'name': '苏州市',
                    'cp': [
                        120.6519,
                        31.3989
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôèĊVnX°¤²lxƒÈÜ@²x@J@b@X`nIUÆUUV@bl@VVnL@L@xJ@X@blJXnW@@`XbWkV@UbVxXUxkV@LóxVbUVW²VJĸklUǬ@ĢƳĠ°@mƒī°»ÈÇ¥ULUU±a@bU@¯U@KnImUVWUkmXUVU@lIVaUUVWKUbUkWKU¥n£WakJUkULK¯LKkVIn@VaUVUUUkVk@U@amUkJ@UUlwX¥W@@UkVmk@JUakL@kk¯ÝmJUn@nmVXlmbVVkn@UJ@±WUxV¯a¯KōbÅ¼ÇxUxUUlWL'],
                    'encodeOffsets': [[
                            122794,
                            31917
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3213',
                'properties': {
                    'name': '宿迁市',
                    'cp': [
                        118.5535,
                        33.7775
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XbWnUJVzXKVVUbWklUWbU@@W@IJ@nVmbVbn@@V@UIUJ@XUJ@VVn°VVbX@lwlJnUVL@l²@lÈUôJĊklb@¤VL@@xVxUxVx@bVb@@xU@lnmnXmXLVmV@X@lxVnVJôLLXax@b@@KVL@bn@@m@@alLUUVaU¥nIV±I@mXI@aWWXU@LlUXWW_XWmaUwÇ@aaWUX@@kWUynÇwUKkLVwUmVI@aVa@wUKUk@wWnlaUmĕk¥ɳçóÑŹVmmzkVmm@a@Iók@@LWU@`WbXLWlkImJVn@`nXVbXmL@Vn@l@nUVl°Xx°U@LVĠ@z°@¦UV@Xn@VJmV'],
                    'encodeOffsets': [[
                            121005,
                            34560
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3207',
                'properties': {
                    'name': '连云港市',
                    'cp': [
                        119.1248,
                        34.552
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@lzXxmÆV@@¦@l`XnlKXXmKnLlab@xmbm@kL@V@Vl@@VUXJXmb@@°Æ@èÈzlW°XĢJlÈ`lInbWV_@m@UUķnôw°ÆmnaVVÛVmĸ»Ģw±Ý@@mUInyUmWkÛ¥ÝK@Wn@@aWUnwVLmUaWIUWVk@kkJUVWLUkÅWJ@bkLWVUbÅUb¯KWbUJWXX`WXkV@KWVXX@bWJ@nJU²mJV¦UbVVkK@b@@nm@@aUK@L@@awWbKóKUIUmkwW@U@UnWKnmWn@bl@bmVUb@kw±n¯wVUb'],
                    'encodeOffsets': [[
                            121253,
                            35264
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3210',
                'properties': {
                    'name': '扬州市',
                    'cp': [
                        119.4653,
                        32.8162
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VUXblVVVb@xV@kzV@lwVLUbVV@VU@VbUblb@nkĶ°IÞV@ƆVlmVÈÅxmKU²ÅJ@xVn@lĢnmbUlVLÆbĢVVbVaXk@VXKVVWXVWXUmKUaWaU@¥@£XWUUV@@ynam_VWkUVUna@ÆV@mnkWmXkWUW@k@@akkllWUI@UnKl¥I@VVma@a@I@U@a@anK@UmK@ÅVUnJlkI@aVwka@mVIUW@UWL@WÅbmIULkaUWUxkLUKWlXL@VImÅVUmĉLUól¯I±l@ÒUbVbUVVXUJUnVV@lnbl@'],
                    'encodeOffsets': [[
                            121928,
                            33244
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3201',
                'properties': {
                    'name': '南京市',
                    'cp': [
                        118.8062,
                        31.9208
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@k@ma@kUUVmVIUWVUUaVa@Ñ²k°Jôk@Wmk¯KmX¯aUakKWU@XULXaV@@mUaVUUl@VmkaUXm@WUUna°IlmVmIUW@Uk@@aV@VVX@VI°»nmU@VKVan@m»UaU@U_@WlIUaaVaUala@¯n@kaUkUUWKU@mwkUUmmL@K@LmUUVKVÅImUJVkVVLèVLVU@WLV@nVÜULVUL@bW@XbWbkJUUVUxVXmVk@WUUkVmIV@nbnVWbJUkUULa@Jma@XkK@VVL@L@JLUVU@V¼nXlbm@kbUKmn@lVb@VXXVUV@b@LVbÆxXbl@@lV@UVV@XVK²VlI`UbVbUlVVn@WXn@@VUV@@KmbVLXÒLkKV@nX@VVUV@bnVllbmnbIWVXU@`lLlknVnmlLlbUmVInK°nUU@l@VU@Vn@@alI`VIXaVaVa'],
                    'encodeOffsets': [[
                            121928,
                            33244
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3212',
                'properties': {
                    'name': '泰州市',
                    'cp': [
                        120.0586,
                        32.5525
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lUU@@y@In@WwXal@Þxl@@anVô@ÆXlŎôU@Vw@ÇUU@@m@UJUUWKkL@Vm@@£aUUmyV@@_kJUUVUUWlUnblL@aUmI@ULUW@IU@WaUK@£UK@aV@°V@LnUWWXIlaVV@£UWlkXĕVLVWb@kUalwUKU¯lU@mk£VôKÈVK@wKVaUkķlUI±ğ¥ÝUŹ¯ôm¦ĸ@XXK@VVXUJ@nlbUx@blJkmIUV@ÆnL@VmL@b@b@V@J@bnbU@UJk¦mL@VVJkXkll@b@@lXXVWlXnml@nÅU@mbUVlVUXn`mb@zU@VVWX@¤¦V@Xb'],
                    'encodeOffsets': [[
                            122592,
                            34015
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3202',
                'properties': {
                    'name': '无锡市',
                    'cp': [
                        120.3442,
                        31.5527
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nLÒlxUVkLam@kVWUULUxVVVbUV@bVLUnnźÞVĠ¦XVUUaôw@KlUVwWUwVa@lUXWa@_X@WmkI@a@WI@w@KmKUUk@@aVUVVÅmJ_@W@a@I±wÛ@ƑÇkw±¯£mWĉUóçK¯VkUWK@XkV¯UWabmUaUUblln@b@xbXWX`@VxUblL@bn@Vb@`m@XbWnn@l¤n@xnVlUVLÆWkV@VbÞJ_nl@nKVU@aUU@mVk°WVLUV¯bVXbXlVn@VmL@xV@bl@nW@X@VVJ@²VJVU'],
                    'encodeOffsets': [[
                            123064,
                            32513
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3204',
                'properties': {
                    'name': '常州市',
                    'cp': [
                        119.4543,
                        31.5582
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@LnxUbVVL@xnnWnn@VVXn@yImx°La¥n@VkKVwW@nXVJ@b@UVn@UnUV@Lb@`VLklVÞnÆ@VaXLlÈJmmVUK@aVUUaUUVwVKXVlUn@blKVUkwÑmKUVUI@±UI@U@WmX@k@aU@wnK@UUmWkaWU°aVUUK¯XUl@nVV@bUVmLk@m`ÝIUaU@lÅXUKkVmU@wmk£m@XmWan@@_Uam@@akKVaUw@W_XWa@w@akmm@mL@UJmnUK@@XnJWLkKUb@VxkWLaWVUImVULUK@L@lkLVVVllbm@@°kbVbUbbVbkJ@XV`V@Vbn¼'],
                    'encodeOffsets': [[
                            122097,
                            32389
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3211',
                'properties': {
                    'name': '镇江市',
                    'cp': [
                        119.4763,
                        31.9702
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VĊKnVÆUnJ@UWKXkVLlKVwXVlbVKnJÆaķn¥°óÇIkWKUbÅ@mUÝlkUK@_a@KVUVm@mVU@@aUIW@mXUxLUlm@¦bK¯nwJzm@UW@UmmXmm@wKUUVamwKm@UbUL@Vmn¯¼JUW@UUU@@bl@@VVXJnnUk¯JmbVVXn@VWlbUnk@VVUVb@nU@WbKWV@XVlLVb°bnW°Lnl@X'],
                    'encodeOffsets': [[
                            122097,
                            32997
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/jiang_xi_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3607',
                'properties': {
                    'name': '赣州市',
                    'cp': [
                        115.2795,
                        25.8124
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@`l@Èbln@KVLl@V@bÈlnKXkVlVL@lJnb¦VKVVnXW@w°@VUmlnUV`UbVUV@xnKVI°KXKVkVL@al@XaLVlULWVVVL@bx@VXVmb@x@VVV@nn¤lb°b°KXXWbX`lbXxz@x`VIVUnKLxWXLVKVbVLVU@wnW°b@nalXmXVJn@U²mKkVlU@@xlnaVmlKn@JVLlnVl@XXÆèVlUX@xVLXVb°W@wnUWmXk@KLVwUmUkUKUw@wVaVK@k@WnkUKWkwlmXL@KVUlLVKXmWUL@aL@malaVk@aaanX@VVUblbJnXaVwn£K@UWmUk@UaWIV@bJW@KmmU@aUUUkmKkVKlUUnKVUlVaV£Å¥WUUK@UkUUw@m@mIkUUWLK¯Uw°¯@wUKUbKm@kkKUL@UUKV¥U@manw@k@U@Wm@@U@WwkmwWaUU@UUmV¯kw@@kmkKkUW@UK@ÅV@XWWkXa@Ul@Va@KVaUUU@aXwla@UkVWaXk@K@lmkUmV@Vmbk@»XI¥VUkVUVU@anKVUKUalU@wX@@a@K@ÝwL@UnÇlUIkJmn@bVVb@VmnkLV¯U@±lIWm@kaUI@aÇU@K@KUIkbWbJUIUyX¯UbU@méUUmUkWKxWIkJm@V¥U_UJUwmVkUU@@knwm@UmkWJkL@n@VW@@U@knm@kUml@xÅx@@XUJlb@VXJVxn@lbV@lULnV@VlnV@bWV@bXL@lVLVbV@blLn@VlK@xln@bX@laLVbnKUVVbKlXVVkxV@nnVUblV@@z°WWkbIkWL@LUJ@bUI@b`@UmI@mkK¯XWmUV¯@UUVUUam@@VULWUJIm`IUJKUkW@UxnWbnnmlXbmIUVmV@Vnb@VLUKWLnÒVVV@VUL@kJUV@bÈ@V°@XVV@l@xUz'],
                    'encodeOffsets': [[
                            116753,
                            26596
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3608',
                'properties': {
                    'name': '吉安市',
                    'cp': [
                        114.884,
                        26.9659
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lxnb@V@bV@ln@nlIn@blVXKnk¼@VUKWL@bL@`UXU`@V¦XLĠ@lJ¦@nV@l°nn@mVXna@nbKn@lIV@VanJ@_lKVVnL@LK@Vn@VbUVanKlLnbnJVbnWVnVVanI@Vb@LbVKVanXVbVJVU@aXLllbôlÆ¼XxVLVK@Xn@xnVVVmb@LnVVKVXV@@mnaVXUVnVK@_UaUmwnKV_anKVL»K@¯ÝU@U@kWlUnlknKVnaUkma@UIUwl»Åw@VwV@nn@ÈXlKVmna@kVw@anm@n_WWk@mUkUK@ImkLUnbkm@wV@klUnLV±m@UInWkWmb@¯amX@xUVUKUaULWKXwKmLUVUJ_@wyWwkaW_XaWW¯L¯akam£@mUU@U@wnaWU@Uw@aUKUXUVKUkKWbk@@bUKUlWL¯LUJmLwU@UVaVU_VkmnUV¯@@xXmWUUUL¥makI@UKUkWlLkmÇ@aUk@UKL@kmÇak@_VlkL@`lbnlLVanLnbmVÆln@kJlbknmKUbÝmmwULUK@bkLWKULUUma@Kk@UV@L@llbVzxUxnl@bVLm@IVJXVlLV`@bn²@J@V@Xmbñ@WbUJ@bm@@LUĬU¦lV@xXb@blnUV'],
                    'encodeOffsets': [[
                            116652,
                            27608
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3611',
                'properties': {
                    'name': '上饶市',
                    'cp': [
                        117.8613,
                        28.7292
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VI°`nm¤²@bVJUVVXUl@Vmb@xV@XbmVV@lkLmbn`VbnU@VaUnbVllUXVa@w°VW@_VWLnVlbLVbnlKnVK@IUW@_@am@ÑUólK@U@WU@VwU@UI@aUUaX@kwmJV@yX@kan@mkwVmmI@aUU@aUUW@kVkV@@anK»XVWnIVUl`@_W@wlUV@UWKnUbn°InJlUV@VnIbWn@VklL@l@Vn²m@U`kI@bWJnV@°VXnJmXVmx@VVL@bkLmWULUmU@bWXb@llnX@xkxVVnVV@¤nLnVxnJVXX@bn`VIb@blmlLnaV@blWXnlUnbl@KVanUVmm_XK@kWWnaU@UnaWUXaXamUkKmXUWLX¯WakKmnUWwXa@KW_aXWW_@WnIVl@XULnWVknK@ImyUUÆbXKÛ@W@IÆUnVÝlkVK@mUIVwkUVaUm@aVIVyXIaÈwmmk@UnanVUmÅaó»lwW@kkUVmUK@WKLUmWULkamKLk@Wa@wk@UU@U@mbUIWVKUXWmkUmVmU@LkakKw@w@U¯UUn¯l@bmn@xkJWxkL@VkI@mkmJUI@V@b@VVxnbWlkÈkVLbkKmVL@V@²nxWkLUL@xlKVxbXmVnWJ@Þ°@nxUKUw±`UImVmnU@kalm@akwU@UUJmxU@@U@kU@Um@@KnVm@kKmkU@@WUnkLWxkVUwmKmLkUbmKUbV@xUnkJ@n±UxVXUWJ@LUblUnm@W@nknUJUVm@kXllknVbÆKVVb¼V@Ul'],
                    'encodeOffsets': [[
                            119194,
                            29751
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3604',
                'properties': {
                    'name': '九江市',
                    'cp': [
                        115.4224,
                        29.3774
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WUkVUkmaVUb@mVUam_nalK@kUnUWaU@@wna@UVkUWVUUI@a±n£m¯_JU@ĉ¦Ul@UVKmmLlm@ğ¹m`Uk¯@@UVK¯@UUK@amkmKkVVUa@UkUKUaL@VVXUJ@n@WUbnVb¯V@LÅlÝIJÅkÝm@UaWUU@UmUXmmwVUUKWUX±mUam@kWzUaVmÇw@aÅLmKXUWKkL@W¯IwVwlkUJ@Um@ÛÈWKUxWkaUU@KkLVl@UKUX±KUb@nVVUbUVmaUlUL@aUL@@nUlWzX`@V@lx²@Vlb@bVÞ@°nl@UxVL@lUbVV@n²xVUVmnUÞbaJ@IV°xnbl@nbÆ@VwnK@VnXlK°xnUlVXV@Vl@L@lk@W_XK@KkWxUL@JnVx@aX@VVUaIXlmL@bVVX@VbnKa²XVWk°a@UnV¤nbmLmW@XbmJUbVLaÞKL@K@U@aVKlbV@nXlJxV@VnVÈÞKôbźĕČmV@Ċ²xÆIV@Þ¦ĸ¼ÞVlVÞnxln°JkLXWVUVUVwnJVI@yn@lXlaXmWI@w»ma@UmK@akKkXmW@_kaWakKWk@@K@IWkUa'],
                    'encodeOffsets': [[
                            119487,
                            30319
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3610',
                'properties': {
                    'name': '抚州市',
                    'cp': [
                        116.4441,
                        27.4933
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°V°UnÜ@n@lnLlV@bV°LlnLllVzVVXlVV@@L@xX@WlXm@UVL@V@n°kVmVUnKlaXxVbnlU@lVVnaVI@aX@VJ@V@bb@Vb@X@lUL@@VlIVm@wUVanLalVnKnLVxlUXwlKVm@k@Una@mWIXKWUÛVk@a@UVWn@@kl@@WXlW@_Um@UVK@aLnalInWV@@xnI@¥Km@kKmnk@mlI¤laXbVblknV@UKXVlUXa@@Unw@±mU@ak_±a@UJUIVKW_Xa@aWUK@mmUVa@IXa@UWmannlmX¯WKXwVUVw@XUlK@klJXa@kkmm@Uww@¯W¯kw@WmbULaUUU@mVUUWmkUbKmkkK@akU¯¥Ulm@akU@m@KVIVV@KUkUVUkaUWbmIkaVaUU@mWbb@bUlkbb@nK@bKXVWnULkKUV@LWKknlxXVLml@X@lULUb@xVxVLVlVnUxK@LWlXnmV@x¯XaWUUK@wVWUkÅçm`@mn@bUx@lmbUnkLÇWm@mU@Ux@Æxk¼VxVJ@nbVlmbUmLklmkVlX@VV@°Þ'],
                    'encodeOffsets': [[
                            118508,
                            28396
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3609',
                'properties': {
                    'name': '宜春市',
                    'cp': [
                        115.0159,
                        28.3228
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VlbnK@b@JLlUnx±ĀXxÆWX@l@V@@blJ@nX@xUbVVUbVV@bVmnmJ@bmbm@klUbLmb@lVb@xUX@bVVVbV¤@LVVbXlVwLXÜÇn@@VIlVkUxx°J@XlKXLVWnLÆK@bÈxUnVbylXn@VbnW²XVLVVUnxWnnV@VVVXVbn@ÞÆlIÞJÆk@K°UUamVa@UUU»@wV@VkkUKUVW£U@UmW@@aXkVUnVlKVVUUkVmU@kWaUanUVVamIX¥W@@aUaUVW@_mW@UnIVVn@VbVm@bVL@anKVUkWKUXVIkx@nabVKb@nVJ_V@VwVUVVXUlUUaV@X@VblabnKlkVaXa¯@m@UKVUn@WXkW@@w@KU@UWkUUUykkmKk¯KU@akUmK@k@mmÛ¯V¯U@L¼UKmLbU`mLxVnVb@`LmUVUUWmb@nU@UWULmU@KnaUUmUwmJ¯IUJWIkVkaWVUIUlWaUIUVkKmbUIÒlVUnn@VlLUJ@bUX¯@aWVUKUXKUbm@UwKWa@a@VkUWn@Uak@mbXWJXbm@mLaWVk@wL@WmanU@knwWmkaWLKWUXaU@¥lUVVVbnw¥nKV»@aUk@a@UJ@kmLma@mbUWnm@ULÇº@LXnmxUm@UbkbW@@akLmWk@UXmJmUkV@VUXVlULmKUxkL@lmXnJ@Xl°Vnb@bU@WbKUX@VmKUX'],
                    'encodeOffsets': [[
                            116652,
                            28666
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3601',
                'properties': {
                    'name': '南昌市',
                    'cp': [
                        116.0046,
                        28.6633
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@X@m@VIUW@UKVbLlV@VVbUlUnLnl@bVL@V°UL@V°@Vln_Ġºn@knKnLVU@VkĊ¥Vk@U»UaUÅLUalmkklWn@VUVIlm@mXn@VmkVa@KXIVUWVw²@m@U@VK@k@WUa@a@aU@IUW@@bUJmbUU@kkVmUaWwkbmLUVUnlWbUbklmLakbUaW@U@VbkVWVUUUVUx@U`UI@maULamb@lwJWUVXLlUVmL@bUK@aUnUam@UUmJ@VnX@`UXVVb@bX@W¦nJUbUmVVbXb@lVUnVlVUUkLmUUVWl@bX@VnV@X¤VUVLllUU@@x¼VV@V'],
                    'encodeOffsets': [[
                            118249,
                            29700
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3602',
                'properties': {
                    'name': '景德镇市',
                    'cp': [
                        117.334,
                        29.3225
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VVX@VbmzxUlU@mbmL@V²xVbUVVblbX@VkVykValKVI@bn@n`lVWnX@lL@WKnVIVa@¯nK@alIXJVIVWUwn@nUnK@alI@a@anKm_aW@UWmIUwmmK@£UUmUUlwwW@km@kWaXaV@VnVKnXlK@aUK@UnwWUnmIUW@¯mUXI@alJV_n@m±@U@kkKUlm@XamJ@UVUkmI¯JmamVXL@VUkV@xX@`k_UVmJUXW¼mL@bU@UllX@VV@bVV@bnJUnlx@nmb@lW@zUnIlx@WbVV@bVJV@UxV@@X@VkLVôÒn@@b@`VX@J'],
                    'encodeOffsets': [[
                            119903,
                            30409
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3603',
                'properties': {
                    'name': '萍乡市',
                    'cp': [
                        113.9282,
                        27.4823
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VWnL@UVWLXaV@@ama¯Uk@WmInW@klKVwnLVKUkVW@UlUnVnIVWl@nXlK@bX@laVan@VnwWm@KÈ¹VK¯m@kmU@¥kIğ@WKU¥@V_VW@_K@aXKVL@Ul»mWLkU@amkJm@kmU@@a@UmakwU@Xl@VXk`UIW¼kWWX@@lxV¦XlW@Ubn@mUkL@UmJ¯UkUWVUaUlm@UXWlnUJ@LmLUnXll@bUVUUmVUn@¦xlnn@VÆÈU°kbVVxllnL@VnVVUl@VanL'],
                    'encodeOffsets': [[
                            116652,
                            28666
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3606',
                'properties': {
                    'name': '鹰潭市',
                    'cp': [
                        117.0813,
                        28.2349
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@XV@nlL@lUnm@Ln@@VlV@@VV@nwVI@VVlx@bknlbV@nmnUVJ_²VxVLw@m¯@ÝXImnUWaUwkL@wVKlKXmw@±@UKnUlLaKlUlÇXkmaUw@U@a@UUkwUJ@zWJw@WbkVWUL@VmUklUaWakb£kJ@nmlnlL@nL@¦mJ@wU@mXkJmbK@bUL@VVn@`kXW@Xk@@lm@UX@V@blÜUXVWLXJ@nmb@V@l'],
                    'encodeOffsets': [[
                            119599,
                            29025
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3605',
                'properties': {
                    'name': '新余市',
                    'cp': [
                        114.95,
                        27.8174
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@m@@WULUKWwÅ»ókakkWK@bUVUIUamWUbULa@KUa@mJUbmUXUmUamImakKmLUbVUam@@UL@KKmUUkL@`mIUb@U@V@bVl@b¼UmL¦mxUaUUVk@¦VWbXVLXKlbXnmx@lmVnb@XKxl@XUbnKn@WaXIWnal@Vb@XmlV@U@bXbLVxn@VaLVWVLXUb°@VW@aVIkK@UmVmkUÑVJnalLVUVJXbVkVJXUlblUXJVI°JnI'],
                    'encodeOffsets': [[
                            118182,
                            28542
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/ji_lin_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '2224',
                'properties': {
                    'name': '延边朝鲜族自治州',
                    'cp': [
                        129.397,
                        43.2587
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Wxĵm@ó¤VX@@xÜ¼ƨ²xWxVV@XVbWXllaÞU°Ċ@ô¼LôÝWanV¥Ñnĉ°¥ÅX¥°¯@w°w@»°k£°mÈŹmÈbÆŎ¦K°z@kxl¦UbU¤klVKŤÞȰ@@bV@nVVUlÞ¦lUllVlU°ÑU¯V°wbXxl@V²@nô¼ó°kmVk²ĕw@wVÞÞ@@Ġö»¯@bnb°mÞ¯°V°ÈJmX¥mamUÅUlaU¯@wKkl±n@@wkÝVUUl±¯I¯bal@kLmakb@ġŹé°Þb°ékLmwXaÅb@bVlbVbÒVbUbUUanwakbVUVak¯ULmxV°UxnôŻX@JXklbkbĉabWU@kWUU¯@@klm@@Å@awWXlKkI@WbUaVIUanU@ĕ¯KmUnWUwm@£ċèkUmbUmm@@nkJUalwk@@nmWUan_óaWmnw±KIwl@UmI@an@@mlUÅmV_KUk@U`@_KUmU@U¯mmb¯@kbImV¯LkbKÛ@ÇnɱJóaÝĢkb@xÒÇll@²VÆUVVUÇ°XóxlV¯lV@bV@nx@¤@șŎnxV¼knJnKX°¦UlnVbUbÆVnÞWVX¦llb@l°VJôÒnLVbbX'],
                    'encodeOffsets': [[
                            131086,
                            44798
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2202',
                'properties': {
                    'name': '吉林市',
                    'cp': [
                        126.8372,
                        43.6047
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôlzaÈV°K@mLWlnVxUVÈ@ÝĬUÈnôLa²VmĀkV@ĠĊnU@bV@b@nl°UVnÞaôJ@bV¦mlkbmVXx¯@VxmnbbÈKV@bÈLwĠyônmnbÜ@nnVx@n²KJ@kal@nxÞULź±Vwkw¯LWWUkŎīVww°yVĕ°wÈVlkÛ»@wW@Uô£@nĶXwWaUamKóÑUI¯@kakkW¥XUmÝÅUVaUamVk¥W¯LmIlmU»mwȚō@£kJUÇk@am¯y¯UVwa@wġx¦K¯X°Ċ¯¦U°ċWULÅa±b¯@UkÅWmVkIUlóċ¹`óIlXWXxmbULÝbƧ@x¯bÈl@x¯zaÝ¤@nmVWb²bmn¯J¯Ò@n'],
                    'encodeOffsets': [[
                            128701,
                            44303
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2208',
                'properties': {
                    'name': '白城市',
                    'cp': [
                        123.0029,
                        45.2637
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@óǩŁ@WlwUaƑwÛÅÇéĉamKōÇ@IôġVȁÑŹçÝUƧċĉwóóÝ@Ƒ»ğL¯ll²@ƆÅV@¦mÅb@nmlU²VxlUn@VbnWbÇbkÒn@èlnlUÒ°Lx@¼ĉb@ÒUċxÅènLVxÒbÅJ±a@_ÅJÅnVbKlnUÜĊ@UxXVÆnmVJÞ¯VĠwXw°xWLxKV¦ôUwVÝǬóÞÞ¼ÞkVôȘxÞUlVn¦ÞĊa°wb°@bÆwlŤL²`z°@V@@nJVnl@@¥nUmmn@mwnmmUnk@mlwUaLnwn¯°anWakIÇmXwÆamUXUlJXaUUklKUknmÞV@K@VWÞ@VkUwV'],
                    'encodeOffsets': [[
                            127350,
                            46553
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2207',
                'properties': {
                    'name': '松原市',
                    'cp': [
                        124.0906,
                        44.7198
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@źèȂÒUóĢ@JŎÈLnĊbÈêÜÆƒxVbkx@XǪłôkÞ`Wb@n°abKnVw°`_X`W¦ĊIkmVakwKx°UÞbU@ll@°¦VWaÞbxÞI@mVI@VkÅUWK¥nLa@@È@°Æ@nU@KÞalkUwVékUWwkUVkkJk¯@»ókV¯ÆÇI@bĉô¯@ķw¯nmmÅL¯wVUÞy@UówÇLkmm@@UóxkkĉmL¯wVwkWWXmLõm@kÅ±V_ô»ÛÆ¯@VaVaĠVlmğwķUóÝƽ£ÇJkbǫaƽLW@nxÝ¤kzy¯XɅm@VôÇX¯Ė¯ºÝnUnLVlUÔmV'],
                    'encodeOffsets': [[
                            126068,
                            45580
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2201',
                'properties': {
                    'name': '长春市',
                    'cp': [
                        125.8154,
                        44.2584
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@U°xÆKnn°mĸx°@Ċó@aÈJ°ÅUôl@¼l°IllUlVXxlVUêVxkllnÈUVll@Vx²IÞ¤VUlVnIôlÞlwô_bVaĶLXÅÞÇ@K¯@wÛaçn¥¯WXyW¯XwUmmÛ@manómğzxÇK@aUÇLamanUw°@WwnUalnk¥U@aóIÝbUm¯Vmk@@aU@amVğĉ@lUnÿ±UbóKmVÇÞī@ÇVUUwmXkKn@L¯ÇUbyókōè@bn@lÝX@x¯ô@ÆUV_maXm@aóJWxnX@VVnĖVnUJ@nōÆÇ¼V¼kxLklÝw@xx@zV`ÅbmxU±xUnnmknğUbUUb@Å°Üó¼U`Æ²@lönKnXWlXUx°xnKĊllôw@Vn@lnÈKôx@VÝzV'],
                    'encodeOffsets': [[
                            128262,
                            45940
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2206',
                'properties': {
                    'name': '白山市',
                    'cp': [
                        127.2217,
                        42.0941
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ul¦kÒÆ°IlÒU¤ôz¼lJUnÆXVl°@²aÆbVKČXV¯°¥¯ĉ°WL¥Ģw@xbUx°V°znb@ÈlVlI@w@mU@akU°kUôwWÈ¯VUVUÅ±U@kÈkÑw@laÞġUÞ£@ƅKnÑĢ¯@WaUaVUVkkw@a¯@¯ÝVXnW@@WkXmK@xkKUb@bW@Uw¯mmb@WKUbmUbUaWbJĉIVW@Il±LkmUbUm@nkKWa¯n@`UbmaĉL@bÆ@W`L@n¯Xb@kb@xL@VkL±mlUIU¥mL@lÅx@_la@UaV@kmmK£LmKUnÅKVbmXVlèĉUUbmlĢÅ¤Il¯bÇ¦l@ô¼Ģ@x°l¤nal@xb'],
                    'encodeOffsets': [[
                            129567,
                            43262
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2205',
                'properties': {
                    'name': '通化市',
                    'cp': [
                        125.9583,
                        41.8579
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÆlXnĠxĢ°lÈ°K°kXm@¦VbkŤJnÝ¤kVÞVVkÈb°y@wkÇ°awƨ@aÞKVnaWwXWkôJ_ČºôVk»óyV£kÑJÅ¯lÑk¥Va@wkbmk£¯@wġó»@kÈ¥°akJÆ£ġnkVaĊVkçWUnUaÆLVmnLKU±@m@a¯UbmV¯m@_KUaÅWó¹@UanmWak@@wmI@y@mkJVa@UaIkJ@n@Um±kkxmIkbÇm@°bXnV@°ÈmlÞ¼¯XVº¯LmkWWXLmVVlkn@@lnWÆVxbmnm¯lÝaVÈè@¼VbÆ°ÞUVJkxIxIV¤ÒXxmn'],
                    'encodeOffsets': [[
                            128273,
                            43330
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2203',
                'properties': {
                    'name': '四平市',
                    'cp': [
                        124.541,
                        43.4894
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ɇn°WzlyÞ£mwX@ƾKǬblaÈIƾ¤ôÞĸVĠxnmmV²wVnwÆaU_@yw@wÞxlkKlwU»È»ŎÅ@mVIUmmĕUU@mWXwIô@bWnnbU`V@Å°ó@wÞW@km@aŎç@m°Ñ°Inm±aXaUn@mƑU¦@Ç¯aU£aUġ¦ÅÒJōUŻókUÇ@¥¯ak¯mUVak@@aċçÅaUm¦Ý`XbÆ@n`IxĊÞōÞml@Ub@Wl_¯JkÇUÝÆÅb@nllUb¯±a@WĉJġĀ¯Unóm¤xôaVnxôI@xV@bmÆ@lnLmÞ¯ÞxVb¯þ'],
                    'encodeOffsets': [[
                            126293,
                            45124
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2204',
                'properties': {
                    'name': '辽源市',
                    'cp': [
                        125.343,
                        42.7643
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@żôŎVIÆÑĢ¥VbV¤°bÈ@V¥ƒÞ£lÇUUUÝlÞ£mţIlUa@¥nlW¯L¯kÇġ¯ğwWmÅk¯UVUbWlXlmnbUx¯xVVknlUbVÇKUb@VnbmlnzUº±bmJUbWÈnèmÒ@X`WL'],
                    'encodeOffsets': [[
                            127879,
                            44168
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/liao_ning_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '2102',
                'properties': {
                    'name': '大连市',
                    'cp': [
                        122.2229,
                        39.4409
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@IÞmVk@wXWÜbnwlLnU@nLlbXW@awnbl@XLa@Ċ¥@LULnJ@xVnmV@VXXV@VJkn@VÜKXXôJlbxl@IVbnJVLUbnlnVwJVU@XUaUUlwn@°nVKnV°_VJwl@nwlVIXWlIVVnK@IWmkIVaVU@WÈUlmU@UWUalkXġŻ@kI»mmakUmĉUŁV»²ġVĕ@aUU؍IɃ`ȃ@kw@Umwĉ@WķÑIĉÇbÝLkymbIwÇmÛbmbU¯ÜõÈkÆVbŎxnXVÆnǪ¦b¤UxÝnĉÒmĊVÈ¤ÈbÆ¼ĀÆÆÞźbVVbX°²¤'],
                    'encodeOffsets': [[
                            124786,
                            41102
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2113',
                'properties': {
                    'name': '朝阳市',
                    'cp': [
                        120.0696,
                        41.4899
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@na@UVI@mÑWkaV¥UI@wl@aÈbm@wVak@@K@k@a@UUmUUalmU@KÇUÅ±¯@±kUKVkUaaU@¥m@@¯k@WLUmkn@mmIkm@amU@wVmkU@Klk@UmaXIWWULaULVbmk@UUmUk±_Uym@mbkImaX¯WWxWKzU@WkJWwkV@Um@UbVVVVXb@VWX@W@Vkb@VnUK±aUUlwXÇWKknU@mmUkLUVVUUVUawbkKmwnIkJ@nmb`kmVkLWwUm@UUUK@UmaUa@UUaWK@mU¯Wkk¯VmUUxVXUVmL¯ymXkWUbmXUKVknWx¯JVnkLl@VVxnxlĀVL²WlXl@bÝVUn@bnlÜaXblIVl@@È¦@VmbXV@@xVVnUn@`°@VnXU@K@VV@VmbnVn@ln@bx°Ub@bLV`ÅnW@@lUnnWVU@Vbkl@Xl`XxVUblkX@°¦VUVVbUlkV@UbVbkLUxmJkX@bbxVKÆlXXbnnala@Uk@UVVklKVUXKVU°KVan@VUnLKVLWVaU_@mmUXa@mwXwVkVWXkk@k@klm@wXKl@U@KVUUUVaUV@alLxUx@b°°VnnVxlIXJmxLUVlV@bnX@VbaVx@XJ@bn@VVXÈl@llX@lUVô°°@ÞVbn@Vk@VW'],
                    'encodeOffsets': [[
                            123919,
                            43262
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2106',
                'properties': {
                    'name': '丹东市',
                    'cp': [
                        124.541,
                        40.4242
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lzXJU@²x@@V@bUVmKUn°n@lnVKnV@n@VlV°WbXn@VzJ@¦@bkbbUl@bkbJ¯zWULWbklVnb¦VJ@K°Ukl@@WbVn°@Vm²UnX`UÜLXmVXlKVbUVVnUbnX@VUL@lUbWx@²kl`n@Vlb@nUVWVLVU@aV@²bl@ÈmxWXVÈUJVl@laWnXKÈkÈ@Va°bÆm@XV°IVV°UnalVUn@UwVU@@VVJI@bl@XK@wWmXUUVbkJVXnJVI@mknwlKXL@`l@VI@UUaVKÞnaVm@aÇ£XWU@aÇUU@mbkKm£@WWL@@Kk@klUbWKUkUU¯UõÛmUUaVUU@WU_W@kVkJ_WKkV@bUL¯¯±mk¯ġğÑ@UmwKUaka@am¥ÝIUWmk@wmţLKʝbȗKWĢklVbX@VVknÇV@XUVUblJXn@J'],
                    'encodeOffsets': [[
                            126372,
                            40967
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2112',
                'properties': {
                    'name': '铁岭市',
                    'cp': [
                        124.2773,
                        42.7423
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XJm@¯mXUlnVbUJU@bV@UJWL@VXLmJVbkXlJXxVL@b@V@n@b@`Vbk@lxknV@VVV@bUL@bV@@bVK@VXLWLXJ@LV@nbWJ@IUVx@LVJUXVxVx@VV@@LXJWL@VU@@L@VnL@bVVmVX@@VVInJmbnLWVnVULVVU@VVmX@@JVzl@nVVKVXÞ@mk_lmUUWV_nJlUÞÑÞVVUVVLUVJ@IVna@@KV@XwWknwnKlalUwaĉÝwJl_@aUaKUUU@WU@WXUÆ@@UVK@n@UnVVblK@bllb@bbW@Xbl@UlnLl°°b¦nKlVnIV@UWU@WXkw@am@nm@aVw@I@KUaVIm±XÑlknJVnVJaX_VaUaVKmwnkmmn@lU@U@mnaXlKUmUIVmklaUK@UlUVUW@UkVma@UUU@JmUU@@bmbKWV¯XUKm@ka@UVKVk@aUKmLkKUUÝUmbXbÇJ@k@WU_@m@klm@UXKVaUI@KWUXaÇWkaWUkWUL±U@lUU@UJI@V¯JmIm@@aU@Uwa@UV@VkIV¯aUkWkb@bVL@@VVVUXW@Ua@@bÝbUVÝ@LmUkVUbVllLUV@LXWbUXm@U`@kxlnnJlbnIllLXlVlUXmVKnV@L'],
                    'encodeOffsets': [[
                            126720,
                            43572
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2101',
                'properties': {
                    'name': '沈阳市',
                    'cp': [
                        123.1238,
                        42.1216
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȚĊÜ°bLlÞxUbUn±@ÈnVÆL@xnLlUVbxkImJkn@V±LUxkV@bbKVKnzVl@L°@VaxÞUlbôxVV@@V±bn@llXLöXĶnal@nkVJVI@aU@@aVK@aUUUU@lmkwl@Ua@_@a@m@U@aUKWwkIlWUanIWK@UXKVIU@@aVVIUamVknW°n@WI@KUmULWnkVkUWKkkmJkamIkmlw@V_n@VWXaW@KVUkKUkValUnVK@ÞVUÞa@a@VbX@VWUU@U@UK@ala@IkKmUUa@U@VkkWVwU_@KÜUXbl@V¥XUVmXakÅlUUkIm`UIUJW@UIKmkm@UUJImmU@VUXU`mIUbUK@LJUUl@X@UbJkU@nm@Uam@@aUmLKwmWXUK@kUaÇa@JUIUa@aKVUUXmUy_@lmbkLUKWLX`n@bVL@JXLWX@Vnb@Vm@UbnVmL@V@x@LUbVV@V@LUVl@mb¯U@xU@UVVV@X@VVblJ@bnVKUnx@llnL±¤b@k`VXÆK@kV@¼kl@bWIUl@VmLnbm@@JXXmb'],
                    'encodeOffsets': [[
                            125359,
                            43139
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2104',
                'properties': {
                    'name': '抚顺市',
                    'cp': [
                        124.585,
                        41.8579
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XVl°bUlJ@UVU@bVxV@@bn@nJ°I@UJIVV@V@k²VVKlXXVblÈXWbXV@LVJUbWL@Vkn@l@nV`@X@lÈIWanaÞVVVlLnKVL@bUlUL@Vlbn@VL°WXULna@aV@nV@IVV@VbUnl@VXnKVa@UUnyWkXaaVk@aabnm@_WKXmWanU@alaUl@XJVLVxX@wnKnVlw@V_@a¯¥@UkKWUaUUanK@IaU@WUaVw@klUVyUUVUUÇ@Iôba@mnUma@kXa@UWak@Wal@a@WULmU@U`mIUU`mUk@@UUK±nkJbUam@kwm@@a@UU@Ua@@K@VK@kmKU_UKUUaĉWmkkL@`LnmlkLkbmK@k@Ulmb@b@xUVIUlmVXXxm@JUUk@WUk@akx±@¯x¯UmbKUUVmUU¯UmVVnWkÆlWbUnWVU¦k@WaÛV@LV`UxXllU@@VVbnVlL@J'],
                    'encodeOffsets': [[
                            126754,
                            42992
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2114',
                'properties': {
                    'name': '葫芦岛市',
                    'cp': [
                        120.1575,
                        40.578
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ll°XnV@XLVb@VVbnb@VLVV@VVnXxlKnUl_na@mlImJnxlLaxVbUVVUVUKVlnnV@lmXLÈWkxVV²bVLm@Ula@UX@XW@UWaUUUUVan@V@lUXxlIXV@yXLwXXW°nblJnan@Vz`l²nVVVl@nUaVKbVKnXVaUaVUynXK@kVK@X@m@mLXaLWU¯w@a@UVw¥°ó¯¯y¯UÇ¯»w¯Im¯ÇUUl¯»ţKċÑţķm¯w@mU_ómk¼VnU`±IkbVlnnU¼±Lk`@XWl¦UbmVUxkXVlkbllUVb@bkVmx@XVV@Jb±aULkKWXkWmX¯aUJmIkVm@xU@n'],
                    'encodeOffsets': [[
                            122097,
                            41575
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2109',
                'properties': {
                    'name': '阜新市',
                    'cp': [
                        122.0032,
                        42.2699
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Xnb°lVlnXVJLlVnl@zÆxnK@bblKVLn@@VaVLVK@L@Vl@XVVInVVKVwlUXwlKLVVb@aV@XlUXbVW@nlWnXKV@@V@XUVVLUVV@@bVVV@@ln@VbVUXVIxVanJ@UIVWL@UV@@¤V@nInwWklnIVxlnzUVÇJ¦VVÜLĸUnW@aV_WĊXXaKnkl@nmLa@alUVw²K@UlmnIlJwaVUkmK@wÅKmU@Ç²VmVaÝwkKaÛ¯șĉķ¥ğ¥@kUWkƏīÝ@@akUK@KWIUm¯nU¯JmwUVmIkJÇLm@UImJUU@aW@U@@nUbJabXVWn@UVmX@V@b@l@L@lUb@xnÇabk@@xVJU¦lbXÒ@nUJ@Vmb'],
                    'encodeOffsets': [[
                            123919,
                            43262
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2107',
                'properties': {
                    'name': '锦州市',
                    'cp': [
                        121.6626,
                        41.4294
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nJ@nlmVnXKl@@°n@@¦VbVbUlVL²l°@Æ²ÈV@LVknVbVVnnWVU@XmWUabIVa@mV@X@@bVVnIVJ@nÈKlInJVUnx°IV°mVnXJ@LLlV@b@ÞƐĬXllV@Ġ¦ĸ¦naWW@In@manK@UVkXJ@alk@»lU@ÅLUWl_@a²£Kkm@kwVmULm@akIUa@U@WUUVUaÝ@ğwkmĉ£UW@@bÇL@ma@_mKlXUwKLţÓ@UWw@K@UI@mU@UV¥@°UnJ°@@_KUwW@UnaWUmmI@mķwUaÇLóVĵwÝUUW¯¦Ux@Vb@xV°XKWbK@n@nW@UL@lWLmzUVVbUbmWXXWJbn@Vkl@LlVUn@xnV@bln'],
                    'encodeOffsets': [[
                            123694,
                            42391
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2103',
                'properties': {
                    'name': '鞍山市',
                    'cp': [
                        123.0798,
                        40.6055
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lxĠÞ@bV@@w°Vna@UkV@K@UUUVa@K@w@UnKmUVan@@Uma@UXWWK@IUK@amW_XKVLlKna@kmKVak@VU@VmU@anIÆan@aUVnb@blLV`ÞLlUbnaKn@naVU@¥°IVK@anUUKVaUVak@mJkXUVwkVUUa°U@W@WlkXWlIXUlJlaxIVVXLll@nLV@lLXlKĊz¥maUlkXaVKX°yIla@aVkala@a@¥IUy@WmXa¯kU@U@mmUULkmm@¯VmnLVU@a@U@±w@VWIkymLUUkJWXJkUmxk@xUI¯`mUULm¯m@kxVVbWV@UVIUx@bkVVVxUbVV@V@zJVXUlnk@@lkLlLUU±Jkm@UIUVLUVU@K@UnnV@l@LlaUJ@zn`@nWlIUVUUUV±Ln@nmL@VUVkLVlUxVLVlÅXma@@akLmWUX@JUnVJVkXJ@X@`WXVUVUIlbW@bVUVL@`Un@¦U`@bUV@z@Jm@@XV`LUL¯J@IVKmKÅI@JnWVnLnVxV¤z@bmV@VUV@bUL'],
                    'encodeOffsets': [[
                            125123,
                            42447
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2105',
                'properties': {
                    'name': '本溪市',
                    'cp': [
                        124.1455,
                        41.1987
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lb@VnlnVVUb@VJ@nnJ@bmXUx@xVbkbkWLUxnl@Ul@xWx@nUV@¼UllknkK@bmbnlLVJX@VIVJn_lJVVXUmnU°VVVUnVVLna°V°w²@lwbl@XVl@VVIn@wWWnUVkJVUw@@anaVk@@lnLlalKnkmK@_lKnlĊXVbVVLV`nL@lUL@@L@VbV@@V@bn@lxn@VbalI²mVL@Vl@nV_VVnJV_@nVKV@X@bkXbl@XblylUUk@Xa@UVIlK@UUWVULlm@UUUnKWU@K@UXmXVa@U°KVUUWUk@aUVKkaWkKUknaWa@U@m@mk@aUJk@@_WKkLmxl@nUJmIUWlIUaVWVXn@xWLk@@aJUI@U@UVVxm@UVkmb¯VUU¯JWU@Ån¯aUbÇ@ÇlLmWXkbk@UIÇVUXWwÇnk@±aU@@bUVUKUXmV@kaUm@k_±l@XwVa@kVK@UWmVaUmVUUakLUWWnÛKVW_m±VnU¯@Uma@Xk@l¯V'],
                    'encodeOffsets': [[
                            126552,
                            41839
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2108',
                'properties': {
                    'name': '营口市',
                    'cp': [
                        122.4316,
                        40.4297
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĊĖÆn¤°Ċ¯ŎWô@xXbwnKl@nX@VUVKmL@VU@UxÝ@VlbxU@VUb@bk`IUlVUnV@@UV@@JnXlK@b@nbÆWUkUKVwUklKVU@UnK@mm²KVUVVVUJXk@mm_@yVIbk@K@kmUm@VLV@VUKVUVJn@l²IVVKklK@kl@kmVUWI@y@UUUVawUUUl@akmmVaUKmIUaJk@wkaóIWWÛL@UlmUIU@WW@UnUUm@wmIVK@Kĉ¦@bWKk@max@bWXkamK@mVkKmxÛaWX@xUlÝnJ'],
                    'encodeOffsets': [[
                            124786,
                            41102
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2110',
                'properties': {
                    'name': '辽阳市',
                    'cp': [
                        123.4094,
                        41.1383
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@`VzWnVUVL@bVbVJ@IÈbVb@lVLXWnxLnKVb@n@Vbn@mV@lIVa@@WkVVI@KVLVanJV_VWUV@nnJVIVn@na@alLlmkVk@»VU@mXwwk@@VmkVwXKllaUa@wVwnW@amI@mUI@VaUUkmm@UkaL@UIĉyLWkkKU@mKk@kWKUUJwkbkIWVkJWXkl@X@X¯VVbUVlUxVWlnI@lUbVUbVLmV@bUL¯J@¦UVmbm@LmbakVÝKU_kK@amaVUbm@ÅbmJ@bVUn@UVl@UbnL'],
                    'encodeOffsets': [[
                            125562,
                            42194
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '2111',
                'properties': {
                    'name': '盘锦市',
                    'cp': [
                        121.9482,
                        41.0449
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vbĸx@nnJVnXmb@VXVxL@`¯@mI¯V@U¦@VV@nJ@V@LXx@VŤÔKLVxWknL@`b@nÈK@a@VXĊ¤nVK@aVU@UnU@ayU£UwmmKXUm@IÆJnLUL@J°IVKKU_@Wn@@I@yVU@aV_@¥Vm@_UKUV@aXkaVJVUUXW@_@WWIUlUIVm@IVW@IU@@VU@mUVVkJ_l@aVa@UVwka@UÞVwV@@UnKLVU@UmWk@mLxWa@wóUVUIÇÆĉ¦¯¦¯xʟJ'],
                    'encodeOffsets': [[
                            124392,
                            41822
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/nei_meng_gu_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '1507',
                'properties': {
                    'name': '呼伦贝尔市',
                    'cp': [
                        120.8057,
                        50.2185
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@m@Łkklô@£kJ°ýɅķÑó¤ğLĉÅlÇğŁW¯¯ƥóÿlwkţÈéÝƛó°ÞÅxV¤ĉĖWƒ¯lȭţυ̃ɱÿķƅˋğɱřÝţϙȍƧĊţ@¯kWKUKm¹Å@ķJU@ƧÑƧō¥˹Ɔ@L@ÞVLn@VōČWJX¦@JŻbU@ţÞmVU@ȁýóbkWWLÅ¯UWġkmó±UŹôV¼ƽ¼ł̥ĖƽǬʉxĉŻȗKΕ̛ʵƨʟÞ˹»Ƨţ»Ǖō˷Ȍ±ȚʊĠUɾɜɨmÜ֞߼˸ƅȂ¯ǖKˢğÈÒǔnƾŎŐ@Ċbôô̐¼ƒ@ĊôĊÞĀxĖƧL±U°U°ĬƒČ°ÜêɴȂVł°@nxŎèbÈÞȌ΀Ǹl²IlxĊl²ÒmôĖÈlĵºmÈêVþxɛČʉÇĵVmÒÈɆôƐŰǀĊ°ÆǬĮƾbyĊ@ĠƒXǀċm»ôw°Ûk¥Çm¯çkkÇǫţǕéX_ĶWǖīŎaÆĵĸĊ@ȚȘĊLĢĉVÆĉʊÇĕóaU¥ĉ°mkÅ°ġUĠřk°mÑČÿÛƒWĸ£ʠÆxÈÞŎÞ»ʈ²ĊÇČalÒ°Ť±ĸzĊKÈ²m¤Ŏ@Ò°¼nyȂUźīǖƳÈē°@ÝĶ@Èkl¥ÇçkxkJXÇUÅ@£k»óƿīÛ@lÅJl¥óý@¯ƽġÆÅanċ°é¯¹'],
                    'encodeOffsets': [[
                            128194,
                            51014
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1529',
                'properties': {
                    'name': '阿拉善盟',
                    'cp': [
                        102.019,
                        40.1001
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƏnǟƨʫŹɆÿ°¯ÆV²ˢżÿ@ÝÆŁȰ¯ȀƳĉó@ğky¹@īwl£Ź¯Ŧé@ÇÇxŋĉƩUUŃōLÇĵóÝnóç@ó@ġƱ¥çWUçÆō@éçťKçȭVһƽ̻aW¥ȁ£ʵǊǓƲɳÞǔlżÞmĠóĬȂɲȮ@ÈĢŮźÔnĶŻǠŎȭгŃċóȭţΗÆƑÞƧÅΫóȘǫɱȁġlÛkÇ°ȁÈnõl¯ôÞɛÝkĢóWĊzÇɼʝ@ÇÈķlUČÅÜķnέƒǓKȮŎŎb°ĢǀŌ@ȼôĬmĠğŰōĖƧbЇƧōx@ķó£Ål±ĀƧīXÝġÆêĉK°Ýʇƅ@ΌʉżÅÒϱʈ@˺ƾ֛।࡬ţશóЈèʞU¤Ґ_޸Ƒʠɽ̦ÝɜL׈ɛϜóȂJϚÈ@ǟͪaÞ»Ȯź'],
                    'encodeOffsets': [[
                            107764,
                            42750
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1525',
                'properties': {
                    'name': '锡林郭勒盟',
                    'cp': [
                        115.6421,
                        44.176
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ʶĬĊIȘƨƨ@ĬÛĢșŤĉĬĀóUÈŚÜènŦƐȤȄłϰUƨťƾÑ܆ğɲƜǔÈèʈƲĊƞƒɆ¯̼V˺Ò˺ȂŤVĢêUÜxĀˌ˘ƨÆ°ѢmÞżU¼ÆlŎ@ĊçŎnÈÒͪŎźĸU°lżwUb°°°V£ÞlĠĉĊLÞɆnźÞn¦ĊaȂīġŃ¯Iĉůl»kÇý¥Ŏ¯én£ġÑÝȭxÇ@Åçķ»óƱŎ¥çWÿmlóa£ÇbyVÅČÇV»ÝU¯KĉýǕċţnġ¯»ÇōUm»ğÑwƏbċÇÅċwˋÈÛÿʉÑ°Łkw@óÇ»ĉw¥VÑŹUmW»ğğǉVÿŤÅźī@ř¯ğnõƐ@ÞÅnŁVǉóJwĊÑkĕÝw¯nk¥ŏaó¦ĉV¦Å`ğÑÑÝ@mwn¯m±@óƒÛKˍƏǓ±UÝa¯lōșkèĬÞn@ŤġŰk°ċx@ĉ`Ƨĕ°@ţÒĉwmĉ@na¥ķnÞĉVóÆókĉķ@ÝkƧƧÛa°Ç@ÝÈUóbÝ¼@ÛÒV°@V¼ˋLÞɅŤŹǠVÞȗŤÇĖÅōbȁƜ'],
                    'encodeOffsets': [[
                            113817,
                            44421
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1506',
                'properties': {
                    'name': '鄂尔多斯市',
                    'cp': [
                        108.9734,
                        39.2487
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĶL²ĬVłƑkkl@ȎŘWńÈĬȗ¯ºlz@ĠĊôŦôÒĠ°kÞÜn@¤UĸèĸbŌÈXĸLlÒĢxɲÆ¤ÈÛƾJÈÝ°UÅĶ»²VW¯ĸJôbkV@ôlbnĊyÈzVôab@ĸÞUl°yǬ²Ǭm°k±lbn°@È»JXVŎÑÆJ@kLÆl²Ġ²ʊůĊġřóƛÞÅ@mmLUÿóĉƧ@»L@`ČĸmȗÑţů±ĉğl¯ĀwÇçƧŤÛI@±ÜĉǓçō°UwôǫůķƳÅ±bÅ£ÓÇwnÑó@ȁƽ@ÇƧĢón»ŏĕóĊ¯bÅVȯÅImōKULǓ±ÝxċŋV±Āȗ°Źl±Û@WÒȁŚŹНŚÅèŌô¼°ȰɞȂVĊ'],
                    'encodeOffsets': [[
                            109542,
                            39983
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1504',
                'properties': {
                    'name': '赤峰市',
                    'cp': [
                        118.6743,
                        43.2642
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɲŁĢǉĊwƾōÞĭ°_ŎŃźȹƒUČÿl»¯ôķVÿǬƽɅġÅÑǫ»̐ʟȣU¯wVWÝÈġW»Þ¹mÝƒɛŎÿŎōͩůV¹ōéċóŹÅVVĢǩʈ@Ėċ@ķÛV°¯xÇÅţ¥»°Ûôĉʟ¥WýČ¥wç»±mnÅķ¥ˋVbUÒġ»ÅxğLƧbWĖÅx¦U°ÝVóŰlô²@¥ÜÞÛôV@²±`¦¯Ý@ÅVÒō¼ô¤V²ŹĬÇĊƑţxç¯Lk»ʟlƽýmłÝÆƏ@mö°Ġ@ŚŹĬţÆUĀĠǊĠX¼nźVUÒ¦ĊxÈ¼@ôlx¯łʊÒÜĀˌÇČxÆČÈƐaxÒĠn¼ŎVÈ¼Ģ°ŤmǖČĊþLV°ÞU¼ċÈUÆzÈa¤ôbknXĀè'],
                    'encodeOffsets': [[
                            122232,
                            46328
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1508',
                'properties': {
                    'name': '巴彦淖尔市',
                    'cp': [
                        107.5562,
                        41.3196
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²@Ζǀݴʶհĸƒ¦Ķ̒Uˌ¼ӾÇƾ¼̨UÞĉƧéÝ»ĕĉƐȍōǪakóó¯a@ôţaV¯Þ¯°@²él¥ĵğťwōxó¯k±Vó@aóbUÇyĉzmkaóU@laóķIX°±Uĵ¼Æ¯VÇÞƽIÇÜÅ£ɱġwkÑķKWŋÇķaķçV@£mÛlÝğ¯Ñťóǿƴȯ°Åł@ÞŻĀˡ±ÅU¯°ɅĀźƧʬmǠƐ'],
                    'encodeOffsets': [[
                            107764,
                            42750
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1505',
                'properties': {
                    'name': '通辽市',
                    'cp': [
                        121.4758,
                        43.9673
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôƲĸ¼Æè@ÈȮwƾ»ʠĢ¥VÆ@²¥@»ŎÑ¯ĊJŤ£k»ÆÇX¯̼ōī°aX£ôƾȁź¥aôŤĢL°ĸ@Ȯ¼ÈÒʈŚôVXůÆaĠƛÈKķĉôÿ@ğÈĉ»ÇVnĉVwXĠÝ°ČÿĸwV¯¯ǵ±ĉǫÅÅm»²Ż±ƽIm¥ţÈķ@¯ƧJV»ÞUÝç¯UġºU£ţóaÅÅlƧī¯K¯ÞÝğL̑ȍƽ@ōŎōĀƑɜnÞÝºX¼ÇĢÞUX°xVʠȤ̏Ǭ¼ÆÒɆĢǫƾUĀóĸ°k¼ċĀƑVŹȺōń¯`ÝĮƽŎĉxġǊɱłō¦'],
                    'encodeOffsets': [[
                            122097,
                            46379
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1509',
                'properties': {
                    'name': '乌兰察布市',
                    'cp': [
                        112.5769,
                        41.77
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ʠǠÞĸɲȺƒÒȂƛŎaÆÈĕȘţUÝźǟɆţÝˌKU»@U¯ÜÑ@Þ»ôaVÞÇÈ@¯ÜbƨƨÞlĸ@ĊôlôÅĊUÝĸm¦bmĊ@nĊxŤÑ@¯ƨĖĊ_@Čwl¯ȭLÝ»ƽ¯ķůǓ@ÇǓbċÅÅÆwÿĠÇU£óa¥¯aŎğĠţkw°»¯ůlÝĵkÇ»Ý°ɱƧǫaóôɱ»Çk¯ŃóʇŐŻĉǊŻĢ¯ÒÈUl°x°nÒĬónĊğ°ÇŚĉ¦ʵV°°ĬÛżÇJȁńʇʹó˂ƽŎÆţ¦'],
                    'encodeOffsets': [[
                            112984,
                            43763
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1522',
                'properties': {
                    'name': '兴安盟',
                    'cp': [
                        121.3879,
                        46.1426
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÆXnlŎ°@LVLĠþxĊUȮĊnUĠV@żaW¯XIŎġ¥Ý@K@w@K@I˺ŻŎ¦ƨƨÒŎIÆ@X@VºnX°lŎ@ƾĉˤƒȘǷȘÑÝÝÞbVţĸÿŤxÈĖƐêÇKnĸ¥ô@ķÞUnÒl@UÅaīˋ¯ÑƧx@±kXřƐƏÛéVˋ»lō¯ĉÅÇÓǫÞĖġV@ğ»°ĵÇÞǓ¼¯mÛÅŃĉĠÇƾb²çéż¯VğÞml»ōÑVç»V¯¯ĕÆU¯y°k¯¯V»ôÇÑ°a@ŹkġKţóbŹ¦ƽȂóW¤¯bĬ̻ŎW°ÅÈl¼ţ¤ĉI°ōÒ@¼±¦Å@Uġ¦ʟƽ¼ÞĢÒm¤êō°¦Èþlk¼ĊŰ°JĢńȁĬ°żnÇbVÝ¼@¼óĸţ¤@°Ånl'],
                    'encodeOffsets': [[
                            122412,
                            48482
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1502',
                'properties': {
                    'name': '包头市',
                    'cp': [
                        110.3467,
                        41.4899
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@źxżĀǔÆǬVȘĀŤ¥ÅƾōôˁʈͳȂŃÈIÜŻ¯ī¯ōm¯ɱĖ¯ķÒÝIÝ»ÅVlÅôÑġğVmÞnnWçkWÜXƝÆwU»Șĕ£ĉÑğ±±ÅkK@lÅIōÒUWIÇ¼¯@mka²l¯ǫnǫ±¯zkÝVķUôl²ô°ŎwŦxĶĠk¦±ê¯@Ý°U°bóŤ@°bôlôǩbŎƏȎĊĖÞ¼êƨÝĊ'],
                    'encodeOffsets': [[
                            112017,
                            43465
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1501',
                'properties': {
                    'name': '呼和浩特市',
                    'cp': [
                        111.4124,
                        40.4901
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ʶUĊ¥ÈřĠ¯ĉômīÑ¯mwk¯ÇV°ÑżġĊǉǓɱţǓƝóX¯ɛÒóa@nÝÆôƜŚĉĢʉŰĊÒ¤ȗĖV¼ÅxWƞÛlXXèmÝmUnĠĢóÒkÆÆUÞ¼ÞJĸÑ°ɲĕ°Ŏn'],
                    'encodeOffsets': [[
                            114098,
                            42312
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1503',
                'properties': {
                    'name': '乌海市',
                    'cp': [
                        106.886,
                        39.4739
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ș°ÇīXŃŗ@ȍlkƒlUŁ±īĵKō¼VÇôXĸ¯@ťê°źk¤x@Ĭ'],
                    'encodeOffsets': [[
                            109317,
                            40799
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/ning_xia_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '6403',
                'properties': {
                    'name': '吴忠市',
                    'cp': [
                        106.853,
                        37.3755
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nLV@VLaÞbn@@l@bUVlUVzVx¤kÞVèXn@nm°a@UÑ@VXnV@VaUVKUUU@@U@@KVa@U²@wXkWnk±lLnU@UmmVKnIVWnI@UK@UK@@UVKXkmWLWUXmlkVwUyVa@ww@aVIK@aVÈwKlLVV@LnVVVnUÜ²°WÈIUÆ@nÞ¼@¦@UÞUVW@UxUxVnbKb¯ÞU`VbǬV@XXÆVVl°InmnUô°¯anam£WVXKXmkôaVU@Vak@@wman@K@UÛUWKXUÇ@UIb@alW@akLUKV@@Ukw±InL@kmwkWmk@JUIůVmnnU@m@UKVKlkUwknVUKmbkI±KkmVkKb@U@aVkUmn`kIlaUK@UUKmbUIÝUa@mUa@am@UUULUK@bmKkbWI@WXwlkXWa@k@kKLVkkK@L@JUVmzUKlwUUnW£XVlKUwVU@aXI@aWaUw@W@_nam@¯UkWVkUWaU@nwmJkUVkWVUmUkJ@ImbUa@@WÅ_mJknmak@@mXaUV@xU@@VUnkV@Vn@`ULUbWLXVW@kbUJ@XW`@nÅĖWJ@m°@xxbnUaw²lÞ°xŤIVVULÛWbbkVVXÆ`UbVL@kx°LlV@VWbJn@bl¤ULV°@lmL@£U@@aUwmKULVxUVVx@@kU@mK¯LÇa¯@'],
                    'encodeOffsets': [[
                            108124,
                            38605
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6405',
                'properties': {
                    'name': '中卫市',
                    'cp': [
                        105.4028,
                        36.9525
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°@Èb°KnL@lV@@UwVUUwVKnLVx@bV@¤@nK@k¯UVKk£@amIXa@UkU¯Klw@UKVaÅ_UWlUaXaÜVKUUţJ¯wÝ±kxVbmaw@wn¯@XIÆĕm@X_@WVIlaX@WUXKVaVK@_Um@lUVm@U@Vw@VUÛwm@@W@ImKUkU@UaaX@wWaUKkw@UVaUamLUnk@»±`¯@kW@UaykbI@VWJkLWUkJwU@n¤mL¯wm@Um²XVWbnV@bmxVkxUblLUV@kVWKU¼kU@mn@JnV@bUnmJUn@k@XlxLVVnKlLVV@@LkKULVbk`WL@lkXW@kV@UÞUlÇXlkaUbmV¯@@L@V@bkb@xlWbbW@±@UJ@IU@mVkVxV@@lIlln@Vm@VUbl@JLmKÛXmVkUKULU`@LĉwKUXlVUl@VbJX¦̼bÞxŎxɜĖĠŎaô@'],
                    'encodeOffsets': [[
                            108124,
                            38605
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6404',
                'properties': {
                    'name': '固原市',
                    'cp': [
                        106.1389,
                        35.9363
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Vnn@°xnK£mV@xlIXVlKXI@UJlazVbX@l°@²_@¼mlVnKVbUb@VlxVLXb@xWbVbV@VlnL@J@Xn@ÜxbW@nl@nblmnIÆ`@X@Vbna@aVUUWVk@kbWakbU@VwW@_l@nmn@@alVlk@UkmVak@@aUXaL@¯@KVa@axWI@KnkVaVJn_lJ@X@m@nVanUVb@mXLlJVWnLlaVVaVX@KXVVkVKlknKVa@aVU@KXb@klJUknUm@K@_UW@alIUamaU¯kJma@IUK@U@@UW@@aXLVVJVaXIKlaUkUV@ambUUJkIWJ@wUIV@JU@UwV@@Um@nU`@UkUmVUxWUUV@aÅb@aWXkKUUUUaWK@wnm@IVU@aXwm@UmVaUalk@anKUwlUwlkK@wmaUkmmIk@VmkUUbW@UVUnW@kV@xkVmbVnU@UbUV@ak@kkW@kLW¤@nV@VU@W_UVUU`VLUV@IUVõVULU@UUUJ@wmkUJ@WI@l@bkKkbVVbVbUL@UUJ@Vm@@L@xbVVVLVlVwX@Vb@bmUkbk@@JWIUVÅw@Km@UkWKXxWLÅ@UVUnWK@xkVW@KULwWVXVWzXVVKVXkVV@VUbV@UVV@@LXxVL@VbLnKVLVxXVmb@l'],
                        ['@@@J@aU@LWK¯UUxVVn@ĠLUW@UbUUUa@KUX']
                    ],
                    'encodeOffsets': [
                        [[
                                108023,
                                37052
                            ]],
                        [[
                                108541,
                                36299
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6401',
                'properties': {
                    'name': '银川市',
                    'cp': [
                        106.3586,
                        38.1775
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@UwVK@UVWÞUbwV@knV@@KU_VK@Kn@W_XWlL@Vn@Ċw@Ula@Wanamī@a»ŋó@aÆÅɲÿUaV_°ÝaLaUmVwVwX@VUVÝ@@¥Ý»@mVÅÇJ¯XÛ±VUmUmU@KUUkKLÇxU@bLUJ@bx@xUbVzUxklWnXVKnXWlUL@V@VL@VL@mJUXmJULnn@VmVkK²mlXWlx±@@VUb@L@@VV@VVULVUbU@WmU@Ò@V¯bmn@V@lVnUnVWXVl@¦VVUn@x@XL@¦lXxVb'],
                    'encodeOffsets': [[
                            108563,
                            39803
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6402',
                'properties': {
                    'name': '石嘴山市',
                    'cp': [
                        106.4795,
                        39.0015
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@U¯ķó±ÇÛ¯ķmbXb@kb@Vĉxm@@UkKWXX`m@@LULV`@L@mU@lUxaÝVUX@VULxVkLWV@JnVLXVlUV@zlVL@V@bn@lU²WVLlLVbUVxUx@xǀLxôÒkK²VaU@wXa@WÈĉUa@bÈkm@¯'],
                    'encodeOffsets': [[
                            109542,
                            39938
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/qing_hai_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '6328',
                'properties': {
                    'name': '海西蒙古族藏族自治州',
                    'cp': [
                        94.9768,
                        37.1118
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@V£°@laXô±źwô@UlżaÜnKw@Uaa²LmÈLÆÈxlaUawÞmÜbÞUnJ°akôÑkwÝVğwÇ@ÝkkV¯¥@ò»nŤ¥XImw@mVwa@ÅwmLkaWw¥l»kçó»@WÑĉğ@ĉŃUwóřVómĵ»Ý@VǕ¯kÝĊÅk°ÓUklkU±IÇÞk±@ƽJ@UġIk@W¦VÑșÓÅnťKULn¯X@¯mUÛ@WÅmóKknōbxÝ@U@kw@ÿÇLţÝUkmwklċVÅU¦LkUWlÅÑ@a@ÅÑ±UóġŹ¼ÈĉmŻ@@wkwKl¯Uġ@lÇUÓ¯_Waĉ²Åló¼VbknKÇÅ@ƧĢō°Ý@ğWÅxUUm@ÝXÛWULUè¯@mbUaLbUWġxIUJWza¯by@ōÈóLU`ÇXUlUĉV¯nmÛbǕLklUĉVóaġƏbġKţnkbÝmmnÝWȭÈÝXţWókUÇl¯U¯ġUɅĀ@°¯¯VÆnmJ@ĊķnóJUbÝXUlVkL@lVxnnmb@¤Vz`ÞÞŤ@VnÆJV°bUôJkzlkl@²ó@ÆÇ°kĖÇbÛU@lmbXVkzVɅĀXˢlńĬŹ@éÅ@ĉńÆ°ğbUlɜ_°@xŦkbVbƒKĢŤVŎ°@żÈźlĊôKôb@nôxŦÆ@ôŎL@þÆb@nnWˌbÈxInaŎxlU@Ñ²±ğVUĢƨbɲ@Þ¥ôUUķWVô¯ĊWʶnôaŤˁ@£nmnIôǪK°xUXô@Ŧa°mkXÆÞVŎkĊ°ÞLÈôyVaIlwX°UVwĢÑÜKôw@nV@m°nmnÜɞ£VbmXn°ÜÒ@xx@Vb²UlbkxVnJUnVVĊ°KČm°nxÇnn¤±¦@UXVV@lVbmVVÈVxÒ°IbźaČbVw@VLƾÑ@Ŧô¯ĊkôÑ'],
                        ['@@@@nòVaw²bVxxÜaČVô_ĊJIVmLa°@Ŏ¥XlK@klKVbUb@nUĢnaÈ@lmǬ»Ġ¯nmnƨVyÑǖĠ»ɲIn@@ÅĢƳ@¯°ôVKÈbVIÇ¥¯@Ýó@ÑnīWKkk@¥¯ÅaX±VÅw@±Ġ¯@»nWmw@@¯VUUWçKĉa±VkkV¯wx@UJx@bknÇbmÅ@Uw±U¯¦UKm¯I¯ť¼ğĊ@ÇŹÈ¯@Ý»ÇnˡJbÛèÇnÅK¯ġĠŹW¼Ålm@¤n²Ýb@b¯l¯@Å¤W¼nV@x°@Vx@lbUblbX¼WÇ²lU@¼V¦@bÇlVxUbVxÞbVbm¦VV']
                    ],
                    'encodeOffsets': [
                        [[
                                100452,
                                39719
                            ]],
                        [[
                                91980,
                                35742
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6327',
                'properties': {
                    'name': '玉树藏族自治州',
                    'cp': [
                        93.5925,
                        33.9368
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɆÿĢV°°VÈklVôŤXÞWȮÇÞXnmÞnlaŤmĢLƐaĢôbĊUVlkǖKÜan°mĊUVVkÈWV_ôKŎÇ@z°abXyVIJĢwVXaKVbna°@VçVKXÜÞWn@VVÆwXĠÞ@Ŏ¯ƨġÆ@ÈLlmUaô»ÆkĊ±Xb°`ÔVkÈĢ@Vk°Llx@xż@ĊnÇź»ôĢ²VÆÒ@@bÆÒXklVKV¥ÆČUklnxlç¥ċç@±m¥wÅJ@VmÈIléÈa°U¥@kÞVK²ÑW°w²ÑK²ñyÆÝVmw»kkWĉJWUVÅwLmÅ@@mwkn¥VÑ»°°@@»¯LlaJônVUÅ¯U@W¯UmÑ¯¯k@WykU@¯wV¥kVwţk»wWÇĉĶçKÞÇaĉbIlU@kwWXU°w±@UKn£WĉKWxkĕVamwXw@Wmnk@aVkbĉLlImmwUÇWxnÝJn@¥ÆkwaXÜĉ¯ÅV¯¤mkx¯kķÜ²VWôŹVU@V£¥@°wn@m@¯@UbUôķmn@ÆÛ@ÇýVaUÇĊV@Çlğ¯xÝŤlVÈÈVx¤VxkK@@x@kVĖġ¥kIWbXŎx@nxÅUW`_@±UaLUxK¯WbkVlbbmLÛÆWIUwWkwÝV@kIéUbUUkV¯Km¯k@UmÝ¯m¯mLÞĉÛUmġ£UxkKm°Lwk@kVmKVUk@¯a¯ĢmóKUUxImlÅnÇbXèVVU°@@xXnm@¼ğ°@²ÆxU²WÆb°@¦llXLmĬ@ÒÞô°@È¦UJÇaLóU¯@°ġƴ@Æ@mɱJğ¼ǕÒUzƧmnmğ°ǫ¼knÇ@bġmmV@VaUaLkl@kLWō¦¯@bKUnJĉIó`ċUÛbwUw±axbñUm@@babÇÅXmƒÝÅôVbÞblUÞVÞU°VUx@UV@l`¼nL@ĊLW¤kXķWġXUVVVķUbVb@°kVVxÈa@Č¦ĊbaźJU@ÈVl@XkôaWĢÞ@laĸUÆb²mÞLĠÞÑôbÒĊaJVbm¦'],
                    'encodeOffsets': [[
                            93285,
                            37030
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6326',
                'properties': {
                    'name': '果洛藏族自治州',
                    'cp': [
                        99.3823,
                        34.0466
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÞVŤÈK@ĀlxV@Þ@wŎalmôLnXÆÜ@nV°@°WmVKŦLÆmȚÔÒUX¥l@ĢJV@ƾI@wW°Ån¥kÅÝVwôÈç@lÑĊĕaJnaÆLVw°kny°UnkÆVČĊll¦Vƾ@@nUźÈÇIn°XwÞKô¦VWV£@£°ókċ±Iam¯Va»ČĉV¥°@mk¥l@Ċm@aUmwX@wÆxmĢ_`VnÆbKVw@@nUVğVmVVöIll@@çÛm£UÇw°@VU¯»m¯JōĖÅLa@»ĉĢ±`U_k`ÇçókXlK@akÝÞ£WċkÝkxJÝ¯ÅwxķxmIÅx@k±J@ýŋ¤UkmV°ÅÝxkwmġnÝVU¦ŤlmóXk¤UKç@mVkK@klī£m¯VUbW¯¼ċb¯ĵam¼mVXm@k¤ÇXÇbU¯J¯¯È@bVXVÒ¤V¼kxÝV@lVWxÛ¦W¯mKnlkU@nƑUĉÝ@ÇºÛċUĉ¥UÞÅz±òL±Ò¯xX±ÒLÝU@lV¦¯ÇbkêÇJnU@ÆIxn¦@²Čè¦è'],
                    'encodeOffsets': [[
                            99709,
                            36130
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6325',
                'properties': {
                    'name': '海南藏族自治州',
                    'cp': [
                        100.3711,
                        35.9418
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vxń@ĊĠĊXÒ°UƾĕÞm°£nb@@LUUWÛº@nlÆǬĠ£ÞV°UXbVȂǵé@kWanm°@xzK°¯ĠVVkwLnm°kÞxÆa¥@wnĉÆ@_l_VwmĸèŤÅČU@Wn@ÑmKUnğK@°¯UÿV£nmLlUUÛé±óókkmnakV@Ç°óÝXWəÞťIţxmmVÛUVȂÓnWyȁĉkV°WnkĊa¥_K°ÿWna@mU¯wlÝIU¤UXó¥ÝLx¯WmJÇÈŹmV@ƽ@Uk¥ĉkċÅUml¯Vmz¯lUxÅKmbIbĉĖkÒ@ÇèóUxÆÞlm¦Æ¯X@x@²ÝlÈJV²klVl¯ÔlĉÆÞ°lUǖÞ@Ķ¼nUôôŚ'],
                    'encodeOffsets': [[
                            101712,
                            37632
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6322',
                'properties': {
                    'name': '海北藏族自治州',
                    'cp': [
                        100.3711,
                        37.9138
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ōmġxƽUm±LǿþġÔ@kxmWb¯I¯mIUx@bbŹVÇkĵblĉI¯¥Um@Æ¯È@aóUlČ»@w»wXaó°ţçÝkUaV¥ÅbÝw¯lmnKlxUğU¯°Lyw¯@mnXbl@êȁǶUWa¯VÝUğ¤ǫkÅ@mÜ¹XVV@K@ma¯¤ÝnƽĖ¯V@¼ôlèk¼¦xXlbnKÆx@bUx@nnxWJţ¦m¼ñ@°¦lUÞlÈ@ĠxÞUlxÒól¯bmIÝVÛaÝnxVbkbÇwÅÇKn±Kbb@VxLmÛŻbkVó@Źxó²Wkb@¯U¤źĊ@lUX°lÆôUlLXaV°wxUb°xÜôÈKVkÈmlwkÈKwKVUŤĉŎ»»Il¥na°LV»²¯Üy@wĢ°ĸwlwĢw°±_lVk@°bÆ¯z@l_@Ģ±lÅVlUaÞLVnKlnÈ°IllČawÞÑ°xUU@wVkmĠLô»KÞýôaÞ¥ôĀÞmÆmUŎV¥Èl°²°a²¥V@@wamm@Ñn@Æ£żVĠ£@W¯Þl@»@Uk@'],
                    'encodeOffsets': [[
                            105087,
                            37992
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6323',
                'properties': {
                    'name': '黄南藏族自治州',
                    'cp': [
                        101.5686,
                        35.1178
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôl²ôÜêVVkKmnU¤VĀ¯°@LmĠVnLÈL@alb@al@n°V_XmWUÈamaVIn@naV£óVWU£°axÈ¥@aĊwÈ¹@óağbm@kw@maÆw@In¯mm@UkkWÑÅ@@kċÅçVkÝJÅkVykŹl¥@¯ĢUÜX¥òýmmXÝÅlmU@£WlyXW»Åbl@aI»k@klm@UxUUV¼¯XlaUnķI@x@¯KĉUU`ólČ¯ô@¤ÞJk°xVn@mbX¯ĀL`¦ĉbml¯XUlȂĊXzmȁÔUÜVUnnŤwŦJɚÝXÞW¯ô@ÈlUbmln'],
                    'encodeOffsets': [[
                            103984,
                            36344
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6321',
                'properties': {
                    'name': '海东地区',
                    'cp': [
                        102.3706,
                        36.2988
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@Òb¤ÆI°ôU¼°UnnWx@b¯L@lUUWbXxWlƨnxVUllXVUnL@lȀý²KVnƾĢwV»@mÞ£nÆÞÑmLKUaVżĕWVk²ÆÝ@Xw°@ô@a°wóUUmIkaVmÞwmkny¹VÿƧnÅm£X»naV±Ýw@ab@am¯ĉVó¦kÝWKUU@WanUb@ôÇºĉxb@Ç¦w¯bV¤UXôU¤bmm@UJnbÇbXVWn`¯Umk@@bka@bÇK'],
                    'encodeOffsets': [[
                            104108,
                            37030
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6301',
                'properties': {
                    'name': '西宁市',
                    'cp': [
                        101.4038,
                        36.8207
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@kmKVUWkVkUmwƧXkWwXaVV@k°K@aXwmmV¯V»¯óÅJ£amX@ċVţÆķçnUx`k`@ÅmĊx@¦U¦blVÞŤèô¯Wbx¼@xċ¼kVôbÇ@Å°@nV°¦ĊJkĶalÈźUa@aVwnJ°°JanXlw@ĢÓ'],
                    'encodeOffsets': [[
                            104356,
                            38042
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/shang_hai_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '310230',
                'properties': {
                    'name': '崇明县',
                    'cp': [
                        121.5637,
                        31.5383
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@uŏu»GPIV±ÐɃŜ{\\qJmC[W\\t¾ÕjÕpnÃ±Â|ěÔe`² nZzZ~V|B^IpUbU{bs\\a\\OvQKªsMň£RAhQĤlA`GĂA@ĥWĝO'],
                    'encodeOffsets': [[
                            124908,
                            32105
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310119',
                'properties': {
                    'name': '南汇区',
                    'cp': [
                        121.8755,
                        30.954
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@`yĉNǕDwǏ»ÖLxCdJ`HB@LBTD@CPFXANC@@PGBKNECCBB@EBFHEDDDSNKAUNBDMNqf[HcDCCcF@EFGLEBa@ACoCCDDD@LGHD@DJFBBJED@BGAEGGFKIGDBDLBAD@FHBEF@RFDMLE@SGANFFJBANPH@@E@FJjRIACDMDOEKLFD@DbDAJI@AP@BGHFBCBGDCC@DCA@CECGH@FKCEHFJGBFDIHACEDNJDCVFBDCRKRLDLITB@CjNJI^DBCfNVDHDFKHAFGDIICDWBIF@@CFAjFJNJBBHD@CJ@AEFJ@@DH@BFBCPDBMFEQGDIFCNDHIP@HDABFACBJFHEBSZC@DP@@JDBƤ~'],
                    'encodeOffsets': [[
                            124854,
                            31907
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310120',
                'properties': {
                    'name': '奉贤区',
                    'cp': [
                        121.5747,
                        30.8475
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@~T~JjZdDbLXDLCB_J@@FHFZJJIAGH@HGR@BENBLID@@LFCDF\\FpDBDb@FAHKFE@dEDDdC\\GreNMACVMLBTMCCFCEGFAA@DAFDLMHA@OD@BMEWDOC@AS@KGAI_DcKwÕísƝåĆctKbMBQ@EGEBEJ@@MBKL@BJB@FIBGKE@ABG@@FMFCPL@AjCD@ZOFCJIDICIlKJHNGJALH@@FPDCTJDGDBNCn'],
                    'encodeOffsets': [[
                            124274,
                            31722
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310115',
                'properties': {
                    'name': '浦东新区',
                    'cp': [
                        121.6928,
                        31.2561
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@EN@JJLNHjLJNR^GRYVBNZJRBV@PDvbLNDN@LGNER@nCNQNuT_TIVFV\\Z\\XnDrI|[Ʉś²ÏJUHOƣ}CA@IO@@CYDATGFIEDAEBBAGCO@GJMCEDCJRHEFANOCADAEG@@CI@FE@BDIC@AGIAIMiEEB@DE@AJCXJDCJEHGBELGCUCeMAD]CIJiM@DSAKJKCLQDQACUECDMIFCBDJGECHAEIWCK@GLMCCGEACNKCEJG@MMBMC@@CIJUINT@JAJSTEPZZCP'],
                    'encodeOffsets': [[
                            124383,
                            31915
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310116',
                'properties': {
                    'name': '金山区',
                    'cp': [
                        121.2657,
                        30.8112
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@L@BIHFN@@EE@@EFBDGDAADVDD@@EF@CA@IIsRE@GDAF@BF@CV@|FBCHBLCNHAFCADBMDCFZXHILBVEEQA@MWFARJJ@DCX@@TEFBLHAAERE@AJABRPBNK\\BrJ\\VHGND@CNADKDADQjGAGNC@GJ@FCFFHC@JF@@dLBDSFADHVG\\DTEPDDHJALIJkJDJCDIPE@YDCBiK@DONE@EH@BAF@HLJA@EIA@ALKNA@@FIFAFHR@NALadsæąyQY@A±DŉXUVI^BF@FFF@HBJEDFFGFEBSRkVEXGHFBMFIVW@GAEEFOIAIPKABGWEKFSCQLQBSEIBC\\FdBLRR@JGACFDDEF@AWB@LJJYNABBA@CUEGPaO_AIE@MYMFIGAEFECHSAAKAO\\[JEDB@E@MMA@@AGBKMGDFFCDDFEDFJF@NPBAFLHFH@EDDHBADDC@DDCDHHCDDFDABDAD@FEFOBCJ[D@HEDDNJBDDHABJIBBvGLBJAH'],
                    'encodeOffsets': [[
                            123901,
                            31695
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310118',
                'properties': {
                    'name': '青浦区',
                    'cp': [
                        121.1751,
                        31.1909
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@RUNKdOFDJCbRFMLAHPLDN@JGL@@APBWYCKN@TU@SHGCEJIDIJKVIZVNM`iNY@CIE@CA@KBOEGEUFCCSADEIEFCDDDIDDHC@CKIeDCG@IG@DHWFEEGCH@@GO@@O]CNpeEQDBFME[JC]DGF@CKOA@QSB@GB@@GW@@ED@AQIJIAAFE@@DO@CFI@KNG@CDACAFEGKGBEGBDCCAIFCCLIECFI@MBCLDHGNAHSF@DMB@EEKBA@@C]DEICFG@ADBHGFKCDAKKHKD@@FHGAANGEEFCHKCECBCKG@ADKCNE\\[A[I@@mGBDQQEO@BCE@AI[AML@JGACLOAFKEMM@EQKC@CUCBCCBCHEA@FF@@FM@GEAJK@GNF@EXPH@FD@M^@HIADJCFDBER@DK@@DE@CAKFOCCBDHIBCNSB@GFC@GQEEOWFICGDUAEJIDBTAHJHEB@DIF@NE@H|HBDBEH@DKBAHEF@HEEUB@FGFGCCCE@AHOB@NH@PRLVNNFBX@RCPbAvMtBfH@DJF@ELBFA@EH@HNED@FFB@HLC@CJ@@DJ@PIRf@HE@CFF@GPHD@DKE@FFBEFFD@DEFCA@DD@IjCRFBAHFDKD@HF@@PM@H@BlbDJDBFEF@DLXB@HCD@@IFCBIFEJD@FDC@FBALLF@PAACJERACAJCBD@EL@JD'],
                    'encodeOffsets': [[
                            124061,
                            32028
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310117',
                'properties': {
                    'name': '松江区',
                    'cp': [
                        121.1984,
                        31.0268
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@DLDFRN@FNELPBDKHB@INK\\BBJF@ADP@RFCRHA@nJ@B\\[\\MFLDBCH@DLDADFGLEDFFMHBBGH@EC@GLLLCBLDHEAGBCH@DEFJ^C@DB@LAFFA@CNE@GTMBGHKCAD@NEJFDKJDDJEDBCDHAAFLHFHBEBDDCH@LMJ@DEP@@CF@BEJBJIBRC@@FX@@HA@@HTA@RPBDLE@CHD^\\INFAERCfFMo^D@PP@@HG@HDFFXECGH@@JDHfCLJ@DGDCCCJCCEDJFCFTBDDVEHFPFLAB@NBFCFKFC@CHIACNOHWHCAAFIDD@CDAGEI@ACFMF@R@R_@GQED@EGFEQEDE_IAHKAEXCQUOQCUDEN@ZI\\DDmAMHCICDSOC@EG@BKHIGMIBCGOCSF[CUHCGEBCTKA@cE@@IGDEEEDI@@HMDBHiHCRCBCLMB@DMCGH[UqI[AMLOAAQIB@BQFBFGBAKFE@SW@CDI@QIEBNXB@FRUFKAGJYWDENCCADBBEMGKDGAAD{EU@@DAEE@CB@HQFJt@JDBE@@FC@'],
                    'encodeOffsets': [[
                            123933,
                            31687
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310114',
                'properties': {
                    'name': '嘉定区',
                    'cp': [
                        121.2437,
                        31.3625
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@F@LI@IDKJADKIEJICADGACFECCJ@HKCAFOHAJI@aCBEE@ICAEB[GFGCKL@FGEIFADMLCAEJM@ELQECEIG@BE^QKKLQCA@EHBIGQ[GEHOMGGDHKH@JOECFCjCBEFDNCACMBCILGTABDLEEOEIG@GFIMM@CGKFBFCDE@@GEAGEEACIcGaHMFITIHDN[AKF@FS@OA@BK@IHM@KCGOKBENaQIDECcPMLQVFHFB@BFBKLGD@FAJOVGIACQ@A`LPCB@JEF@RU@ANS@@RCL\\HIFpRBFRBBDKLLDADJDGBFDABHBEDNF@DGBBBADKDAHC@\\JJFBDEH[DEFDH\\LX@XLBLbT@DNJLDCEL@VJABJNDHB@HBHYFBAA@GNFB@@AFB@AFABFLFBHFCL@HJBAFBLC@DN@HN'],
                    'encodeOffsets': [[
                            124213,
                            32254
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310113',
                'properties': {
                    'name': '宝山区',
                    'cp': [
                        121.4346,
                        31.4051
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@mÖoÖi½[s[YEUJU`SCIEBCCWJY_LIICDWU@@FaBCJIB[ICH[@@CDKEE@MK@@IMCAEBCH@AMFI@SMGEFGB@FK@BHCAIFJNQD@FEBDFMBKGACG@ECWH@@CDDTOEEBGEK@GC@EE@GPHFR\\JHGA@FDBKRLL]RAFH@FJFDKR@FINBFKDCNEBFJEHK@DLEH\\HFADB@JFFDA@bIJGBEPDBGLI@DDEFBDCHDBIJJFCLIBCL@JKJE@ADHDBHJ@HIBBDFHBBAEIJ@BJFAVL¢'],
                    'encodeOffsets': [[
                            124300,
                            32302
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310112',
                'properties': {
                    'name': '闵行区',
                    'cp': [
                        121.4992,
                        31.0838
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@T@@ELE\\BCMJGJSNEbGdHDJFBJAFIEIFCEWG@@gMENSFCVJFAxR~B@IH@AIiI@GE@FGEAFQPDRiV[\\DFSGMHAXHDOMCJCDETBBNVJJI@DD@ANNNH@FILDDMFBDHNDHKL@XDFGLD@EHGFD@DDB@CDDHCDAEAHG@ABOJ@BIaC@CECLKPFNCDCJBiQEIF@@@OGBMIAEEBMTHF@NKEC@QFEGA@EBCKAACHCLJHEFHHB@AFCAIEACIC@HG@KCCDC[ECEED@KC@KJMAAFQ@GHG@BHIJYIGE@EI@A`KDWCaKcCiY}I}S[CYJM@CFDVPRRVWDFLBBG`JCFRFEFFHC@RF@HQ`Q@E@ENBDJ@HFCB@DCCEJBBGDGXMPBDGJ@DEDELEDMA@DJF@DMZ_jMNYUUJILCJIJDFGH@TSVM@DLXZ'],
                    'encodeOffsets': [[
                            124165,
                            32010
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310110',
                'properties': {
                    'name': '杨浦区',
                    'cp': [
                        121.528,
                        31.2966
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@V@CXJDKJZ`XIDDFADJvSRMDM@mFQHM@KCMKMuaOCU@BDAJSX@HKJGD@PNJCJWAGT@R'],
                    'encodeOffsets': [[
                            124402,
                            32064
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310107',
                'properties': {
                    'name': '普陀区',
                    'cp': [
                        121.3879,
                        31.2602
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@F@@FHDL@HFFAPFCSDC@@XGFDH@BDLHNACEFA@ERCIMJEDBAGL@@EHAFENHHJ\\ONQBQCIBC[MKACKI@GGGH@I_G@CW@[DMHCDIBMTDHN@JNHEH@FJFPKFACSBKHDJNABDMDECAFiDEDFDIPG@GLHCNH'],
                    'encodeOffsets': [[
                            124248,
                            32045
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310104',
                'properties': {
                    'name': '徐汇区',
                    'cp': [
                        121.4333,
                        31.1607
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@RADL\\NCPHFfLJaJ@FWLGMGIK@IFMDOYYFOTSBI@IMSAMSACFIDNDCPWGGBHNET[CU\\QjOCERFBEHF@@HjJBJG@@J'],
                    'encodeOffsets': [[
                            124327,
                            31941
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310105',
                'properties': {
                    'name': '长宁区',
                    'cp': [
                        121.3852,
                        31.2115
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@HFFB@HF@DCAELENSJADCNG\\CX@@D`H@JHGHHJ@BINBFUGEDO[MCKQB}AwQEBUIEDMTNF@hH@FXEDFJEJIB'],
                    'encodeOffsets': [[
                            124250,
                            31987
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310108',
                'properties': {
                    'name': '闸北区',
                    'cp': [
                        121.4511,
                        31.2794
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@CSG@BQGODUPWTOBQAAFMECKBGEMFKEOHADDJARMR[PGI@TEJBNG@ADBFND@JL@@NFFCL@D\\@DG\\JJADI'],
                    'encodeOffsets': [[
                            124385,
                            32068
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310109',
                'properties': {
                    'name': '虹口区',
                    'cp': [
                        121.4882,
                        31.2788
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bA@E@QHSXBDIMI@OHCLI@GTWBIACQAYIOFGCENBBARSPOXCVHPARH@DT'],
                    'encodeOffsets': [[
                            124385,
                            32068
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310101',
                'properties': {
                    'name': '黄浦区',
                    'cp': [
                        121.4868,
                        31.219
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@NEHFLAFDHDPEAMZUHQQ]IMKJG@EPERABHBGRUCCNGV'],
                    'encodeOffsets': [[
                            124379,
                            31992
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310103',
                'properties': {
                    'name': '卢湾区',
                    'cp': [
                        121.4758,
                        31.2074
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VDHQGABAFQFOH@LIiKKHEXI@IbAFZB'],
                    'encodeOffsets': [[
                            124385,
                            31974
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '310106',
                'properties': {
                    'name': '静安区',
                    'cp': [
                        121.4484,
                        31.2286
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@DLLB\\NPGLFHUDMYABEeKEVMAAJ'],
                    'encodeOffsets': [[
                            124343,
                            31979
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/shan_dong_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3706',
                'properties': {
                    'name': '烟台市',
                    'cp': [
                        120.7397,
                        37.5128
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ŤLLllVń²è°xżĢĠÆlÒŤbV¤ĊXnlĢVĊÒÈ°ĊŰÞèL±@џn»VUźċ²»ÆkôVɆkĊŃ²kŤVVwUUVmUa@KkU@mUmmk@UwUkmW@UVIXa@mw@aKULax@Uk@UbWU@yULmK¯@kXVUwm@@JUUknWKUVLUbU@wWykIa@w@mUI@aUVynIWak@@Wbl@@knmK@wnIl°Kna@V¥ğ@ġUķ»¥@UōJX¯¤k@wmI¯k@mwak@@lX@bUJ@VbknWxkLkxlLVlkLmb@bU@bU@VbU`Vb@nL@mbU@VnUVmnU@mm@kIUWVIUKVkkUJUnmL@VmLUaVWaXamU@U@KUUmVUJUVÇwğnm@mXĉV@l¯xnô'],
                    'encodeOffsets': [[
                            122446,
                            38042
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3713',
                'properties': {
                    'name': '临沂市',
                    'cp': [
                        118.3118,
                        35.2936
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bXll@zlV@lXXmkbVVlU@Vn@@Vmb@XKVXWJ@XXl@ÈbVLUl`@XXV@VVUxVbUxVb¦@WnXVJ@bnVUzl@°ÆxUKlU@mUUnUlUVWVUnVV@XX°V@Vll@VkaXVl@Ux@bmbXLlKlb@b@bUJn@@b@n°x°K@an@@UlLVKVbXb@bVVnK°LVa@UVa@XwKVxnLU°@naV@UWUkWULmVwÝKUUla@aó_@mK@aUU@WUkwVm@aVI°W@@IUw@a±¯@¥kUVUm@awkw@K@kVKk@maXalI@alLWXblaVLVUV@LnK@l@waXaLlnUlLmV@n°J@_VmnIVym£UKmI@WnIVm@anUVmÇ_kġIÅWUXÇm@U@Ý¯Å@@naWIVW@IkK@klKn@naWImk@abkKkLWnWkLWmk_@UaVUKmLUw@mn£WwUmUaóV@UkUm@UKULUwmJUX@WW@XÒzVblJXWXk@UVWKX¤UL@xU@@VUaU@@XmVkLmWkXUyÝLmKXnV@n@lx@bWLnVVn`knULmxUlWLXVb@VK@z¯x¯¼WxKUn@bk@lVVVz'],
                    'encodeOffsets': [[
                            120241,
                            36119
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3707',
                'properties': {
                    'name': '潍坊市',
                    'cp': [
                        119.0918,
                        36.524
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l@@UK@@L@bX@@VlL@JLUVnX@`ÜXn`V²mJ@bU@@nb@l°xnnĸVÆ°@Ċ£Þ@lWnÑnkʶJmó°w@kk»V@»¥k@V@kw@wVmaÅmaô£ŎXI@mlnKla@mV_UK@kUkw@alWIU»m@WUIl±UUÅUbkJ@a@wUKUaVIÆmXIWaka@m@Ul£XKVw@UIJUkmJVkU@aWKImV@UxmL@bX`WXU@U`ÇkUak@@°UblXkmLUKmL@VULóVk@@Vlbn@Ub@ċaUJUbIUlVLUVVbVKXVlVXU@mb¯@VmKUwLWx@Ub@VUb¯KmLUU@aWaUaULkK@Vm@@b¯L¯w@ma@m@UUU@U¦lJUXVmkb@nmXVWkbIVxUV@VUbWLXVLW`Ux@nk@Vn@x@VkJ@V`mXk@VxV@lVI@VULVUIV`°bVXXxV@VWVnL@xVUb'],
                    'encodeOffsets': [[
                            121332,
                            37840
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3702',
                'properties': {
                    'name': '青岛市',
                    'cp': [
                        120.4651,
                        36.3373
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@nUJXL@blVUnIVlIVJ@UxWLk¤@V@nlbXbWJÅnUJVbVL@x@blIaÆVVVk²VJ@XnV¼JkX@blxlV@VLU`@nkbLkm@nWJōó¤bnÆbUn@xlxU@l@¦@¼Ul¼ĊUnW@nĠmÈxUVIVnUVV@LV@nVWbXbUVbnK@UnKVmVIllUVLUJVXlJ@nnV@nmVUUm@Vna@K@mUaV_UaV@aV@@aanlKUkKklwlKXwlma@UVI@akW@l@bnxl@°nJxl@°£WŎIUÑn»lamô¹Ŏ¥VaUUkmkġWɱIUUŹ`@kk@ĉƨřV¥_Ç@Ĭ¤ÝL¯m¯£ƽóķwUW±ī¯kōaĉĕkğmó°bW@UKkLUaVmz@V@UxVn'],
                    'encodeOffsets': [[
                            122389,
                            36580
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3717',
                'properties': {
                    'name': '菏泽市',
                    'cp': [
                        115.6201,
                        35.2057
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@¥IVUÈmÞ»@UlU@Un@VW@UVmkk@aVUUKVÝ@UVknK@UV@VVnIV@wnmwmKXaWaXI@UV@Vy²blkVKkamU@kb@Um@VmUkmKmkXKWwkU@Ul@UnK@UVUUmKXwUVLwKU@@Wl@@wUkV¥@@I@W@_V@VWUw@UUa@aaWa@@_mKUwl¯amzmV@WKnU@kWLķaUKbÝVmV@UWÇbÛ@X°UbW@XmVlk²UJUbmLÇxÅWUzl¯Ll@VkKXUbWJ@bU@¯@kbLmKka@l_WXºVbUz@Jn²V@¤lXnV°Ln`WbXLôVlKVUxXnlXLlU@bVV@XJWLUVnVV@@nl°nnVKÈbVXÆJU°VnXVkV@@xVL@Wlb'],
                    'encodeOffsets': [[
                            118654,
                            36726
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3708',
                'properties': {
                    'name': '济宁市',
                    'cp': [
                        116.8286,
                        35.3375
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nam_nKlVLXaIl`_@KVVXI@m@w@@k@Knô@n`VbV@@LL@KVVn@VX@VLJl@VUUU@Uam@UkwKWaXamkJmIUVUÈblaUnV@kVKl@@lXL°kVJ@VÈnVJUX@VLXl@xVLnU@VKV@aIUaV@bĊUxKkVJXUlVUVaI@WUI@KlUnwmWk@WXIWUL@Wna@Um@@UVkUUlanWW@kkU@ykWkaWVUlÝbUU@kJUIU@@JmaókLKÇUUkKWLk@WbkUUabmKn¯°¥V@XwV@VanaVaU_@Wlk@WÈ@VUÈVVÛmaklKÈ¯lLVUX@lK@aX@@kV@VmV@VwnJV_UWUwXam@kW@wVUkKVIUUVmU@UV@IVK@aUL@aV@LmUKmx@ômLkUWJ@nXmlUxUL@VknVUU@VL`Ub±LkV@kUKÇbÛ@UWó_mJ@Wk@@X@VLxUKVWxLVnUV@VmL@Vk@VlVXxWLnlLnVlUnn@@VlaV@nlbULkl±aUzU@@VWJXbWbnLnxm@xUmJUUU@@VmLUl@VUÞVLUV@bllUn@VUXm@@VkV@VÝ¼ÇnUVJ@¦nnlnVlL@Þb°KVV'],
                    'encodeOffsets': [[
                            118834,
                            36844
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3714',
                'properties': {
                    'name': '德州市',
                    'cp': [
                        116.6858,
                        37.2107
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@¤@VmbVXnVVbVJX@ll@zlVInl@@bVxUbĠl@ÈblaIxXVWb@L@nULWVXXWWLnL@`@LUVVL@lVnJU@UUkanVôôb°¼VÞXIÜbČabôWXÞWÈzÆmnLVJ°ÈnlV²lbnW@@UUVmnwmkkKWkla@mVIUKUaaUwmnJU@@amIk@@bVlkX@mmUklUUa@_UaUUV@wwWkXmW@I@WUaÝU@UXaWUU@UUVW@UUUWUn¥nUVa@m@k@alU@wkLWa@UUm@@wnmUwla@anKn_@alK@Ý_@@WUUUmlkaIyU@UwU_Wa¯yU_mWUwkImm@InWWUk@@UVWVkW¯U@VL@b¯b@l±¦@VV@lUbV@kxVnUl¼XV@b@lV@nIWxnb@UULxÅxm¯aUwU@mUÅVÝKULm@bmKUXó@'],
                    'encodeOffsets': [[
                            118542,
                            37801
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3716',
                'properties': {
                    'name': '滨州市',
                    'cp': [
                        117.8174,
                        37.4963
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vb@`bVkVlnV@nlWUk@al@nJ@bV@InmVxbVbVLUJ@nkblXlLnlmxnUV@V@mXnlbĸ@nnVxb@lnXV@UJ@nVxxnxVbÆVn¯ƒĕ@@wÈçUÇlķVIb@Çmk@¥k@UkUK@aWakUóJW_UW@wkkWK@U@K@XUUkmUUalKXala@U@kkWlkÈl@kVmVIVmU_awnwVW@wwU@wU£wkJWIyUI±bkVUJ@nmVUklXmx@lnbWkVUkLWxkKUUmUkbJ±LÇxUKmkUmkkWamUaVkJÆ_²KĠ@UW@wU¥nUWwK@aÝUkÅVaVK@akLW¯I@bnbVx¯JWñWbUL@nV@VmbkUUV@IÇak@@bWak@WJUJWL@bXV@@VJlb@zUlUUImnbVmz@°UV@VbV@@V@L@xLmKUnmJVXJ@VkLW@UVUL@b'],
                    'encodeOffsets': [[
                            120083,
                            38442
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3715',
                'properties': {
                    'name': '聊城市',
                    'cp': [
                        115.9167,
                        36.4032
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ô@VWnLan@VKÞLÆUnVV@xVbn°ÆwwKVV@maXwmJU@@k@aWUk»VUmlw@UVa@kUU@²¥@k°a@aK@UU@mmm@ówÑ±¥¯@@wKmwI¥kU¯UmakJmIUaVkKUkm@VUUaU@UaKUK¯@wUVUIUKVwk¥wbV@xn@lWnXxlL@`XlJX¦l°XxW¦@¦Uln@@@Um@@VXVmx@¯bllUnUJ@VULVn@bxVVL@bVlnVVblVÈnVlIVJLôlJ@xl²'],
                    'encodeOffsets': [[
                            118542,
                            37801
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3705',
                'properties': {
                    'name': '东营市',
                    'cp': [
                        118.7073,
                        37.5513
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ͬUǪlô@°Uw°ōĠ¯»Ģç»XÇ@wwƑaÇkwVƑ¯@ÅķUmm¯w@ka@mV@@anIU±m_ÛW@_mWVUK@IkK@UW@@a@K@L@Vk@±U@UV@lm@mUU@kLmxV¤@xVx@xUXmxxbV`UnUJnU@lÇkkllX@l@VkbWbkLVbnVVlWV@@L@VXLll@xVXX`ôIlVXb@bVLVll@@¦nlÈ@aUJkĸVÈÇè@x'],
                    'encodeOffsets': [[
                            121005,
                            39066
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3701',
                'properties': {
                    'name': '济南市',
                    'cp': [
                        117.1582,
                        36.8701
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²¦Òôxn@nn@V°VlXUUX@Vl@XVmX@JnnlJVxnXV`°zXbV`VxV@zJlbkVnVV@X@`@ÞkL@bm`mL@bkbxnVm@xn@VV@XbKl@xkV@b@l@nUbmVm¦XVVV@VUXVVV@XVWb@VÞVVb@X@JnXlWXx@xUVV@aVKVUX@lK@UIUWnIVmnLK@w@K@UU@a@UVU@¯nyUmanVJVVk@ykaIU@@WU@aXKIVXIl@Xb@al@Èb@JVUlVna@UmU@VKXaòX°IUwma@aU@UU@wVW@Ñw@aI±`kbUkwUmJ@UkmÇUUkmKknUV@mJUkaWka@KmKkULmyXa¯_@WmImmbLmUkVUbUVJbUkkWJkUlIUmkLlK@knaVmkI@mWaLUKUU@@VmLUVLWK@UUUWUkkVmx@Vl¦'],
                    'encodeOffsets': [[
                            119014,
                            37041
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3709',
                'properties': {
                    'name': '泰安市',
                    'cp': [
                        117.0264,
                        36.0516
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n¼WnxL@x°@¥Uk@nwlUVlXVV@VXLKVUnK@UV@VVLKXb@nlJUnmb@lkLKlVnJklVXIllVaIVUValUnVKannnJ@X°`WbnzKlVnL@LbXlbVlnI@VUU@UmV@U@U¥@VmV@@_Ua@m°@@kmUUm@UVmn@nX@@aanJVUVLmlIVJn@nkVLVa@KVmVLXVVL@@U°bn@VaV@@K@aVkbWaXUVymU@aUImWX@¥UaVwUaVwUUU@WW@k_VUKÇa@nmxkV@LVJ@XJUbVkUWVUIlLwĉVaU@VbJ@bUUL@mVUK@wWkK@UVWUIÇm@UUI¯lWK@kk@UL@lmUVkbÇaUVVnJlInWbXbLxVln@VbV@VUV@kIUK@UWm@UU@LK@KU@Uam_ó@m@L@l@@x@nWJUU@L`k_JWbUKkmLn`mb'],
                    'encodeOffsets': [[
                            118834,
                            36844
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3710',
                'properties': {
                    'name': '威海市',
                    'cp': [
                        121.9482,
                        37.1393
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VbUnVVUxĊ¼¼ô@ÞÑ¯WǬLŎUÆW¹UÇō¯ÑÝkţţóġóLł̥Uwm¥kÝmkkKóbÝ@U¦@mb¯LkmJ@xLmn@lk@a@X@lXbmJUzV@bVJ@n@xblJXzxV@VaKVUXLlmVV@In@VxUlW°@nLVK@zXVVal@@VwbVKL@bnx@WbUJ@VnXVlVxl@nnnV@lV@L'],
                    'encodeOffsets': [[
                            124842,
                            38312
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3711',
                'properties': {
                    'name': '日照市',
                    'cp': [
                        119.2786,
                        35.5023
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@UaVUUKVkJVaVIČb@Vam@ka@Ul@UôVK@UnKVLnKlkWVa@¯l@VbÈlV_V@XWW_@anKVwUmVw@@UnyUVblKVLX@aô¯ó¥mÛĊÿÈ¥Þ¹lUī¯Kĉ¼ʟbÇVUUXmakJUnmV@bUnmJ@XnJVLn¤UzmJUn@`¯ImU@nKVkkmKWbb@xk@mL@KUUVUKkbWaXkK@bkJWbnbl@UL@lL@lxx@bnUVlV@¦²°@bVx@J@¯XUJ@bUnlxVX@VV@bL@nô`@bkbVVÞLxnU'],
                    'encodeOffsets': [[
                            121883,
                            36895
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3703',
                'properties': {
                    'name': '淄博市',
                    'cp': [
                        118.0371,
                        36.6064
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nlKV@nVn@@kVU@²VVaU@wmKXU@UUWwUW¯aU_JUVVK@UJU@kUw@UlnWU_@lI@U@wUml@@mVwX_KWUXKVa@UVUUwJlaXWUn@mlanUVWkIV¥V@VVVI@a@akakLWKna@aVwk@WUbUlk@k@U¯UWWU@mUUVUXkVmVVV@nkVLVÅw¯k@WVXbaUl@bV@@b@xkVVXVxkJ@nk@@VLUlVbVXUVVUzVLVbUbVVWVkLmkJ@n±@UxUVVkV@bx@ÒUX@xVVV@°JXlK@bULUblÆÞV@bLXxmV¦V@xXVğ@±LÅ`IUlVbnbXllVnnlVLÈwK²IlanVVVlLwXlKVlUXma@knwWlkVnU@mVIUl²aVJzXJlI'],
                    'encodeOffsets': [[
                            121129,
                            37891
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3704',
                'properties': {
                    'name': '枣庄市',
                    'cp': [
                        117.323,
                        34.8926
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@yUUUkl@@aVmLXw°»°w@yL@UUaWXKVknwVKlm_UmmUXK@aw@k@mUWmUL@@@£@KbÝV@akwaULmbUKLUU@lm@°mL@nUJVxVXU`mIUxU@UnU@@lW@@bkLW@UVkKÇ°kLlbnUÜÇUUVÇ@@Xkl@XV`UbmbUbU@WxU@¯¦m°nLaVblVXal@XKlLVVÈLKôlnbI@V@VJI@lVVÞaVkXU'],
                    'encodeOffsets': [[
                            120241,
                            36119
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3712',
                'properties': {
                    'name': '莱芜市',
                    'cp': [
                        117.6526,
                        36.2714
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lmnLVlÈVln@VnIVlxVla²_JlUUUVVw²@@mlInlKXUUUVaUaKUVyUUWVUUaVkUK@l@@mlIUwUWlU@w@aU@@LU@Ubm@¯a@V@UKWUUKUn@LUbUKmlm@UIkJnUKUVmIb@b@mWm@Un@VVnnVl@¯@@nVb@`U@Un@¦@V@VUVnV@'],
                    'encodeOffsets': [[
                            120173,
                            37334
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/shan_xi_1_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '6108',
                'properties': {
                    'name': '榆林市',
                    'cp': [
                        109.8743,
                        38.205
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ýVnIW»W@»kUÇLÝU¯¥ÇIUWWÑUWwX¯m@»n@ÜÈķô@a±kČ±wÑmwçċmU»ÆkkVyImĉÿ@Ý¹WnwÇVÅazmmĉ¦ókVmxxU¼VkVm_UlVlk°IVkmJa¦kLmmV@XmKnlUôVXbb@UaÇLğÜÅw£mKnmċwÅ@UkbmaVn@m¯aUJm_k@kWXyl@@kÅamwLUÞmWÅzUKUk±@b@nnKbX¤mzVVxÇn¯@ÒknWVUbkķÈÑWkk@VaU@mUkbÝÅ@Ý¥ÇbkĬXV`kLÇVmalUUanV±nwmkJ@In°KVw¯UnÅ@¥U±bUU±mWbÛKWnUm`UƒVK@bmnmÈÅ¼@VL@xxmŤ°n@VmK²VllKkô@êÜV@VXLlm¦UV°Ș¯²ÿ@¥@ÆĊ²ImĶnnb°bKVĸLlÞ@UȮÜ°IVÞÝÞlx@ķĀWUxèÆ@°XnlĊĖ°mnV²V°ÒÆ¦aÞ@zll@bÞĀl¼nKĊ¼óÈb²±IǪÒ¯ĖV@lxnVlkJlaXwŌĉ@VnlÆĕUÆLèŌŤôxÈlU@xlaUċĕXmIWmnkVVVW_@aÈWUUmk@¯çVm»±W¯n¥VmkXw±ÇVw'],
                    'encodeOffsets': [[
                            113592,
                            39645
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6106',
                'properties': {
                    'name': '延安市',
                    'cp': [
                        109.1052,
                        36.4252
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@kkÇmImUwVkUU²WmVkm@m`mIĢĕUVa@mXÿVVkyUýĕ@l_UmnWKVkţ¥awğ@@aôWakUma¯¯a±£kxmmxUwÝ@xmUb¯KwóÝ@kmm¹Ub@lklVbmnnVUV@xUknƧJUX@LÇWkwLķƧÅwWJkLkþĉxWzJUnÇk@Ɛk¼ÜÔÈKè@°lÈÆk¦ln@l¼@l¯L°UUVÇ°¹`m¼mXkbUaV@U¯x@¦ÇUUmlmUVmnnmlkw@@¦ÅÇLmx¯Ikl@¦mÆ°VUx¯Lm@JInlmxU²mVbkVbUnÈlKU_WlīÈaÞ¦Æ@ÞlanV@VUbl@XlÇÒĸlVaUXlm@Ñ°ÈmUwUnyW£amL@ma²@lVVLÆynXÝVKnxÆb@lk@WzX@lln`IV°b@nmUnbaVlÆ@ČxmnnL¤ÆxĠÛÈKVb@aWaUókVmnL@WUnnKl¥bnIlU¯JlUkVkn`lUUV»wnwlUôĊ¥nnyÆb'],
                    'encodeOffsets': [[
                            113074,
                            37862
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6107',
                'properties': {
                    'name': '汉中市',
                    'cp': [
                        106.886,
                        33.0139
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lKnb@nlWb°bkxĸwVb@łnlĊ¥L@XlÈVblÈKbakVwôml²`n@nVKlk²xŎ°¦VUJĊw@çnWçÞVkUóÛ@¥kwUmX¯WÑk@UymIUwlUn¥mUk²a°¯V»@ÝVÈÝċÅÅVl»@l@a°±@_kammÅba@m@Å¼KknõĠ@m¯LÅwLVxmb@¼kV@mw¯wVakKW»X±¼¯Vkxb¼W@nx@x±bóakb@ÝmU@ķÓÛLkVUmk¯¤ÝLUlÝ@Ýzx@x°bmX¯aUJW¯k@bÇWwÛwWx@XWlb@VÈUlwLnl°VlUô¦U°¤VUxVXUxlbkVVlI°ÅVlU°m@kÇU¯xUlLUlVL@b°ĠInĠ°ÈnK@xÞa²naUyXUKVkWô¼Èaz°JXUVÇV_JVz@nb'],
                    'encodeOffsets': [[
                            109137,
                            34392
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6109',
                'properties': {
                    'name': '安康市',
                    'cp': [
                        109.1162,
                        32.7722
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bĊaƨèwôô¼b°aXVÞVUÞ@aXm¥kImx¯¯V@anU@UÇéğL@¯¥V£m@ÝÈbKX°wČÿb@xÈblxÈ¯ĊmÆUVnÈ@ƨÜLĢ¥Źn°VnnKaô_ÈwUaXmnW¯klLXÇō¦ÝaÅVmbğUn¥±wÅéVan¥U»°am¥£Ý@wVw¥nUÑUmmVwmķIÅaóVWxkblb@ból@ğÒĉ¤ċX¯XxkÇ@óÆÅx@xķ_kmÝÇ£kblb@`¯²@bk@k¼ÆUČÆÞÇÞU@U¼¯°±bVlnm¦kVVxnJVz@lÒXW°nVlx@¦ôÜVUlÝXèm@è'],
                    'encodeOffsets': [[
                            110644,
                            34521
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6110',
                'properties': {
                    'name': '商洛市',
                    'cp': [
                        109.8083,
                        33.761
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²nlôb°aVwnKÞI`°wXôw°VĊ°@ÅÞÆVzÞK@x@aLÅ@b@nLl@lnmnLVwabVVnbU¼V°blbÈ@ĶŦb@nÇ@amIyUI@ĠVmôUVwkwlanJ¯lwó¥@an°J_@nóƒó@£l¥UwmaÑ@Um±V_J£JUW¥¯@_k¯¼mUVUè¯b@wmL»ğVmağI¯¤ċIUWXKĵ¦ķaJUbIlUóVmk@WÅÅÇ@mUÅVnĉÇ°kwÇa@waċĀ¯xWLÇa@ÞnU¤°¦@ĠKÈê@VmV@bU°°nwlJn¦WbÝ@V'],
                    'encodeOffsets': [[
                            111454,
                            34628
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6103',
                'properties': {
                    'name': '宝鸡市',
                    'cp': [
                        107.1826,
                        34.3433
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@£@°Ib@¯°ynŹaUlU£Umĵĉ@@ylUÞ@@£kWU¯WaU£¯ÇV¥@kb¯wn¥ÇkUÇnU@¯±kULm@m±_kónUxlbaÇLkUaÇkW@Kĉ¦km@ŁUaķxlw¯aXak@mmakL@mÛ@¼m@lXV`nKU°°@²¤UÈ@VxmôxKlVV²aVwXlaVlx@UVnÇnk°VVLlkIJÇk¯V@knÆn@lznmlVkzVVVx@Uxz@x±¼VxxUlkb@¼ČkVXlĠkôV²wLUKlwJ@aIV¥Þn¯Ün@nkl²kÆ@°aVbnI@Ťn'],
                    'encodeOffsets': [[
                            110408,
                            35815
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6105',
                'properties': {
                    'name': '渭南市',
                    'cp': [
                        109.7864,
                        35.0299
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ÈôLxU°Þ@mÈnl¤nUôLwX`@ÞÝLUmLôôbVbnºlnÞ@ôx°LanVwÞ@Vxnwnlw²¤b°°bVnlXbó@bĠ@xb¦ŤVXġ£W¥ƽɽó@ýóƝÝ»£XmƅĊkU@ókťaĵÇ@aka¯UV»maUUabUxmKnkm@kmK@xó@¯n¯KÇ¦@ôÅèlxkx°nƾ¯KU¯WķL@VÝIUbyWbX¼Ç°'],
                    'encodeOffsets': [[
                            111589,
                            35657
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6104',
                'properties': {
                    'name': '咸阳市',
                    'cp': [
                        108.4131,
                        34.8706
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@IXyĊwlýKlXIVaķ»a£¯aVU@awÈōaL²»VUln°WÈ¯W»XazVaÞJ@U»@¯Ýbğwly@£kÑţ±WÑ@kaIUn@¯ómţUbU¯lÇIÝb@¤Ý@kV@zĊ@ĶnVV¤kVbmź¯z@°a¯J@¤@bUxb@`xUÔ±ºVXWUnUJLĢ¯ÈKlblmÈXŎ°U°LlkÞK@Èxl_°ĶUÒkbl'],
                    'encodeOffsets': [[
                            111229,
                            36394
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6101',
                'properties': {
                    'name': '西安市',
                    'cp': [
                        109.1162,
                        34.2004
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°²@mVVÈÈl¦m°xla@U¦°ÈV¤XbV°lXÞaÈJ°kVaŤVôn°@mVJlb@XÒŤ²lÒ@¤kzĠxÞa@°¼ĸK°XV°Lƽ¯mlwkwÆç@óÈ¥°L°mô@w@aÆK@b@wÝLyÅUÝÆ@ĉ¯¯UóxW¯x_ÝJmLUx¯bóak±mÝUUW¯ba»óóxƧçĉbaĉxIUV¯¥ō±wl'],
                    'encodeOffsets': [[
                            110206,
                            34532
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6102',
                'properties': {
                    'name': '铜川市',
                    'cp': [
                        109.0393,
                        35.1947
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÆxĸƨKlxÈXK@VWƨIlmV@wVUmUnmUalk@kVaUaóaónKVÞK@ÝW_xóKmVk£ÇmnÝ@¯VwóK@Ç¯XkmVU±¼KbÇŎx@bUV°b¤b¼ĸUb'],
                    'encodeOffsets': [[
                            111477,
                            36192
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/shan_xi_2_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '1409',
                'properties': {
                    'name': '忻州市',
                    'cp': [
                        112.4561,
                        38.8971
                    ],
                    'childNum': 14
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vx@lnbn¦WlnnUm°²VVVVVnUnºlz@l@J@kXWVXl@La@KULlbnKlLnKLnKÆXn°bVV@bUVl°Un@LnaVJUbW@UX²l@ČwlVVIWnkÆa°anVKn°UW¯@aVUVk@Un@aV@ValwUanmWUk@WVUUanaVwnLVl°@nk@mVU@UVK@wLVKVU@K@UUKVUV@@bnLaVaôlIXmlKX_°KVV@bVV@zV`kblIVUlL@bnV@VĊllVlIXW@kaU²blKVnIlJalbXXlWVn°JnnL@l@XlJlaX@XW²@l_VmnKUblU@mnkVK¯@U@ma@kX¥VmakkLa@a@WIUUVXWWnk@a°a@kkm@kUUmJm@WUUUIk`m@VkaWWkXKmXk¯@WKLkak@±bw@aa@aka@ma¯@LKÇÅkKWbkmġ±ÅULUKVVkm¯LUVVbUwUW¯bmULxWJ@klmkUm@@KnwVkVK@akw@@a¯bKknVUIb¯mmbk@UbmKUL@xUU@klmLUlVXIVVVUVUU`mLXVWbXnW`Å²°xmxU@mĉwU@mbU@UmbkVW¦kJ@X@`¯Im@UlUVVnb@bWJXnmbJUUUUa@UamIkax@@x@b'],
                    'encodeOffsets': [[
                            113614,
                            39657
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1411',
                'properties': {
                    'name': '吕梁市',
                    'cp': [
                        111.3574,
                        37.7325
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@a@w@wlbnJVb@VbVVVInaWmXI@aaUmVUVkn@°J@_W@lIX¥lUnaVV@naV@xĊnV@wn¯wÆ±X_WmXaWUnKV_VVUUUUWJkUVnKlk¯@@kmKUaÅ±KkU@WmI@WUIlUUmVwXw@UlUVwV@LnbW@anU@UaVkô@l»n@naJnUÈLVaÆUUVmVKV²L@mU_lK@UVWkUa@a@U¯aUaÑóÑUbKk@@ak¯mVaUwVÑkWUmK@UUKmXUWÝwUaLUU@aWJUUU@UaÝU@WL@VKVaVI@WnU@alIVK@kImIkJ@m@@@_K@x@kaW@U@Vmn@UK@mIJUXV¤XXWlkKkkK@XmJVakImJU@ó¯LWKUV@nUVLkxmKkLma@kXKmmLabLmK@V@mXVÆUxX@`nLaV@@VmLUVnLlLb@°²nx@bVUxlb@V¯bUV@zVXVĊXVx@lVn@VnnmU@LlJXVz¯VWVXbV@bmnVUVkÇþÅ@XVxmbUlVUlnW@Xl@VLXÒ@bÞJ°¦Lò@nUb@°X@XbmVUVnb@xx'],
                    'encodeOffsets': [[
                            113614,
                            39657
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1410',
                'properties': {
                    'name': '临汾市',
                    'cp': [
                        111.4783,
                        36.1615
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nW@@UnLKabKnnWL@lnblKnLlwKVU@mVUXL°KôV@nIlJUbnI@WlLllLXkWWU£VWInJ@VL@nm@UVX@lb@@wL@`@n@V@lw@nVmVXWmwnUla@_lKwVlUn°xVKVXXWlUVVI@K@Kn°KwlVlU@kna@V_WnmUVm@kXml_@mLlKXw°m@_ôJVUV@Xl@UaV@Va°Ilk»VwUkVmwUmmVn@V¯@KUwmK@U¯wUVÝ@mJUnWK@@UnKVa_lykUmKÛnm@x@UUlwVkXW@a@U@@K@kIVnammVakUl@wX@@k¯@VVbml@°UbULmlVbnbÅK±VKVXUJWa@ULWaUU@@U@aWK@UkxUKLUUUJ±UkL@V±kk@kam@UV@l@LWl@n@VVUxLlUUx@VUVU@aIUlL@°mLUbkUUaWUUaUU@aWKLWJ@bUL@VUVVbU@m@a@kmKmnĉlUKXWUblbxmIkU@xWb@lkVxLXmzVV@bklVVUzm@bk@Vx@xlU@lUbVnl@Wxnl@n@UbVmLmb@`X@lUX@@xlnkLWaUJnnWVVn@l@bULVV@lV@XnJVX'],
                    'encodeOffsets': [[
                            113063,
                            37784
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1407',
                'properties': {
                    'name': '晋中市',
                    'cp': [
                        112.7747,
                        37.37
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@lInJlJ@ULkJ@bmV@XUJUbL@UXKV@ÞVbV@VVXI@bVVKVbÞxVXnWVL@VnLVlXÒUVxUb°nl@bl@LVaôÒÒVb°b@VnLnnV@lmn@lbUV@JUVVXkl@lUzmJ@xXklbUnJVUbnUlbV@nlLX@lakV`Ub°@XVJnUL²KlxnI@KV@lbUbVVKnVl@zlm@U@nI@WUaVl@@mVU@XkW@nkVKV_Vwy@knwVa@XalU@Vnml@X@VLKVaÞbnnlJImVKnVVVInVlU@m@mXK@UmyUI@mWUUakamw@wUwmLkakwVmKw@wUam£y@am_W@UU@knmmamU@WUa@knw@UUUUV@nJm@mVUkKVUUUkKmwKULKUImV@lUnnm@mbUK@°bUnmbUmkkWUb@am@UXkK@a±@V@ĉÅVUXVxUVkLWl¯@@bULUlm@@nm`XlWakIkmVUbUL@Vm@kI@@Km@VaXI@W@aU@kUVU_KbJkkÇb@nkKmLwÅW@kVUUVU@WUIJmIXmma@_kyVaUUlkUm@kUx¯Lm@L@LUJUkVWXUWUL¯wVmUkxkL@`bkmVnxXUWUnm@kxU@'],
                    'encodeOffsets': [[
                            114087,
                            37682
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1408',
                'properties': {
                    'name': '运城市',
                    'cp': [
                        111.1487,
                        35.2002
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VlnJwkaVaXWVLĊknmnLl@@bnV@UaVU@UVK@aXIKXL@bVVVbXVVblVaVnK@¯KVkJ@bVVU@UVwkVKVwUUm@@Xk@K@kVUn@lbl@²l@UlK²VVIVVKVLlw@VXL@b@VV@VXbVK@XbVIUWLU²ÆLmaUankVKVa¯@nkUaU°@n@@kWaUVaXUW@IXKVw@UWU@W@@UUU@mn@`m@UUULkUmJIU@@UK@U@anak_@wmKUwmakVkmKVk¯bw`kwUIÇx¯»ÇaÅmn@@mmUkV@wkKW@kxmLUkĉLÝkxÝw¯lóVUmV@ĀVVX¦W¤kz@`Vx°²ĸ@Ul@xêĸǊ°¤VVlXLWnXxmV@nUl@'],
                    'encodeOffsets': [[
                            113232,
                            36597
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1402',
                'properties': {
                    'name': '大同市',
                    'cp': [
                        113.7854,
                        39.8035
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²£yl@ČĖ@bĸĢbĸXaKŤnn@ŎôllÈxnVnÞÇV@bnXllL°KbVb@J@b@UxlKXLlKlXk@UlkJlkUVKXUÇVIVm@_nÇLalwVnU@UUwma@aaÝaLmUk@@W@U@@XwVWÝUUUk@@VmLKV»nwUwaUL@`mzJUIVUaUwKUaVIlJôanÑlLVUn@a@VV@@UUwVK°Vn_lJÆLéW@UUUÅ@»lm@aÞIVwXWUUkkm@U@aU@mwU£VWU_kWmXwW_°yUkkK@UÇK@kkUVymóKU@KWIbUak@mJ@bkbmLkUmkVUW¦@lnb@@V°ULml@nkVaVmLUnk`±@XWW@kbÇ¦X¯WxI@xmbmxXlWV@bÅUz@Jb@bÞbU@Wbk@xk@WX¯VÛWÝbÝUkVUU@alI@a@akLWam@U¯UUmÇL@K@aU@¯VUkKmX@`@kJ@nVUb@lbVÆXVWULU`VbkLUV@XWl@bXJ@VbV@Vl'],
                    'encodeOffsets': [[
                            115335,
                            41209
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1404',
                'properties': {
                    'name': '长治市',
                    'cp': [
                        112.8625,
                        36.4746
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@UkLky@IJVa@mÞaWy@_W@_WXVlUVw@nw°K@mUVamVkU@mmmnLVUmKXaU@IlKVUnK@UmWkX@WV_V@akU@aKWIXyIUVmUnUa@WaXUVKVmkUWVkULU@@VbKbIUm@mbVLxWUUkn±V¯wbÅJUbmLkbmKÅKbVnUbVKUbKUbmLKmbaKkUm@UnnVnxUVlUxl¼k¯JUbU@Vbk@WU@UVóI@`¯nWxkLK@nk`Wn@lUnVnmXU`@mb@lkV@VnklVVUblz@`nbWnnJIVJ@XUVVUV@lÆXxnKlL@maÈllIaLV`UlVV@@b@XJWUb@n@L@lJn@@UVKVaUlnlJXbkWn_@mn@VkVK@a°@XklKVUUwVWUĊÆ@U²@@blLVWn@@bVaXllVnnaVma@¯VLnan@mVm@knUVJ'],
                    'encodeOffsets': [[
                            116269,
                            37637
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1406',
                'properties': {
                    'name': '朔州市',
                    'cp': [
                        113.0713,
                        39.6991
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XXWVXVWnnlnn@èÆ¼@xlVnblVÈUVl@blnLÜĊmUkU@Ua@WI@aXk@WVUlKUaV_VKXWUUÅka@VaU@mlI@@_nWLVl°UV@@b@LÈKVn°V@VnXblK@b@bkJ@bVVlUÞVÞaXÜ°UXWl@wl@XaV@Ýa@aa@IVyÆ@aXUWknwna@wJXw°WÈ¥kI@W@kmKm¯IUmkXWWkabkImJUkL±aVb@lWXkJUkĉk@UmU@aKkVUkJlaU_y@UU@aUU¯LW`kLWnkJóbUbmK@aU@UVVL@VL@UVULK@xUL@VUV@nml¯@UkmKUxmbVbUV@XlXVmnVbkxUbU@bm@@VUlUVb°@VX¯m'],
                    'encodeOffsets': [[
                            114615,
                            40562
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1405',
                'properties': {
                    'name': '晋城市',
                    'cp': [
                        112.7856,
                        35.6342
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lVLbanLnKVaLVaLUVaUmaÆLnLlanKVaÆIa°x²UlmVVXwUKna@VnJaLa@UV@@alUkKVKnkmmVwUkw@@kxWUXW@@mk@aUa@a¯aLkKmwkUm@kL@K@aWIXmVXWkUVakL@UVKw@aUK@UUKmLU@¯nKUwVUIWJUWmka@UXJk@UkmW@kLWKVx@bmI@VUaVU@a¯@UUmVKmX@±`kÝKVxUL±akL@VbLkKmV@XWVUbVXb@lm@@lW@@xklVUbnnmbUlJ@@L@@Vb@WXUlkxVV@wn@ÜmnLlVkz`UbmL@V@XLmVnIÞ@VU°x@VnLxV@LU°'],
                    'encodeOffsets': [[
                            115223,
                            36895
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1401',
                'properties': {
                    'name': '太原市',
                    'cp': [
                        112.3352,
                        37.9413
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VV@wVKnLVal@na°naVJUlmL°a@b@lx@bULUlmx@Ln@lVknl@XIwKVn°aVXVxUaVU°KnUlUVLKÆV²ĢlnXalLÈÆLKUaVkUanmWUa@WwkUWU¯y¯Ñ@anIl@@aVUmIymULUUVakaU@@LmJkw±LKmVUI@W¯VaU_lkbW@kK@mUkaVmVaUIVmalkW@wnIVy@klkWUUVI@UVkam@knU@mmmK@bblVUX@VkLV`@n±KUULUnVVÅUbÇKmVImbm@k¼ó@Ulb@VmV@bXmaK@UUxkVV@xWUxVnkVVJ@XnJ@XlV²LÆVbnL@l@°'],
                    'encodeOffsets': [[
                            114503,
                            39134
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '1403',
                'properties': {
                    'name': '阳泉市',
                    'cp': [
                        113.4778,
                        38.0951
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°@nb@lb@bbb@x²al@lbKXU@mkUWkkmUUVwV@XUW@naVklKXblKnLnLVanImaXKlLaV@U@KUKWalXK@£WKXUV@VUUUVW_V@W@@K@UIWmXUmULnJkImmÝaUbLK@UWk@mnU@kVWb@Ubmx@lzUx`UULml@XWl@UV@nk@UVb@XJm@@Vknyk@zJnUV@bk@mJ@b°Ò°zXVlVXx@bXVmnVbUlVb'],
                    'encodeOffsets': [[
                            115864,
                            39336
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/si_chuan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '5133',
                'properties': {
                    'name': '甘孜藏族自治州',
                    'cp': [
                        99.9207,
                        31.0803
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@aXam¯wm@±°wUwV@UaVw²KU@UU¥a@£ÞôxKnkmX¥IUÝUwlk°V@ÈKUwlkUyV¹mx²XllÑW»lw°UŎnJl¯°V@wôIVÇnnUllLVÇLô¼XW£@±@¥k_ÇJkUékwXa@Llw²Vxbm¼ÈxlLÈVWÞn¯mÇÑUÝlÛkwlĉmULmwUJç@wkm@ÑlUXÑôġVaUÑ¯@wķÓkbVmnU@@y¯IķKV@¹aé@kmÞU°¥@a¯@anKlblU¥@óğç@Çw@wklaçÝ±k¯±@ğÝUÛmÝ¯w@kb±¯akXWÜkXUÆÇU¤X_ƐwV@¤XUbUIUlÇUkġ@aXČmlUlèUV@mVk¦Vx@¦±¯¯¯anlW¯nÅw@w°KVak£m@klKknÇU»óKīlaUaV£@¯@ÆUVÛÝÇXÇlÓlŹ»WUğJ¯£mxLĵôºXVlUll²bllxónn°ÝU¼mJU¯nV@êĉ°Uĸw@m@¯kmXamÑ¯aUwÝKU¥mÅn¥Wmn¹n±ƑƆÇôXê±ǊnUôlĖkȂVÒ¯¼VnȮ¯ĀnƆĢ@k°V°¯ĢVlkVxm¼X²Ŏ@VxknWÜ°U¯nÆÝ@`ôÝ²ÒÇznmX@xè°K°ÅUČĬóĖÝó¼ÅêÒbmk@V@Òl@nĉÜêx@ĖmlÅJ¯¦óxȭ°Ým¯LĵèĀ@Æl°żX@xmkV@z@°blnÞ°J@bn@Æ¼UVUóóL°X°ÝLxUn°Ĭn@lnL@Æ@nKÆxnUnVInĬmÆnxŎ¼ĊIĢóÞ@ĊƨbUmV¥lkwnLmÅÆ¥XwU@wwUÞ@alUUÅUVkkm°aU°Ó°w°Ub°a²K¯ĕ@ÈbÞĊa»XVm°InĬk¼VbaJô£VĊankůnÜU@anKnĮbÈmÆ»nIé£Ġ'],
                    'encodeOffsets': [[
                            103073,
                            33295
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5132',
                'properties': {
                    'name': '阿坝藏族羌族自治州',
                    'cp': [
                        102.4805,
                        32.4536
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l@@þ²I@lVL°wnJ°UĸŎèIlwV°¤nĮ¤ÝlèL@@xlè²ôĊ_ĊġVÈôJżīlbXÆÈVkxÇVn°¦Üb@è@nn@@°UÈ¥WÇ_Uala¯¯UÇk»mVwk»k²°VxlL@¤_@x`ÈĖöb@l²alXa@bnK°¦VK@nnWmx@nUnl@@llĉk°l°UXkmW@Un`kÇLWÛÈVxVVlVk@lIXb@ylXÈWĮWŤzy@mI²J@n°@VJ°aÅ@ŎkVÇkaUwKVwV@nkm@±ôkôĊJ¼InÑm±nIÞXÈĊxĊUÈbÜyÈ£Vkw@kVUVm@a»ÜbÈmUXwÝxUn¥@°ġÅaJVkaW¯Û@W¥UŏĶ@¯kUŃ@aI@mmanwÞW@mw°»Uřk¹±WxVx¯¦U°zţWw@°ÇVÑk¯@y°a£@mnl¼aÝÝakwU±aĉImlĵn@m@kkV¯Ñmĸ°xl@XVÞmlÛÝĉUÅ¥mwÅ¥VaUwXġċaVůÛŹlwU¯Uó±xÛV±¯¯n¯mċLmnĊm@_kJWaXmwUĉK»@mwXÝUÇkKÇw»naUw±kxK@WbxlVêlÈIl`@¦@²X¤Wó»KUÈKkkmVmUÈóJ@x¯Uk°Imō¯VxkX¼Òkk±WwnUºVzklVxLÇ@¯UklVxÞVJW¦nmlLówÝ@¤b¦V@VV±LUxVbU@Vx¯x@²n°xnWbb'],
                    'encodeOffsets': [[
                            103073,
                            33295
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5134',
                'properties': {
                    'name': '凉山彝族自治州',
                    'cp': [
                        101.9641,
                        27.6746
                    ],
                    'childNum': 17
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĶóKnw°¤ĠIXV¼kźÔkÈWÞÈÜUVÅ°@@U¤VbkbĬôL¼ÈVlmLlkn@l¤Ub¯L@xÆx°mXmk°b°°²@¥Uwl¥nU@VUkçVnkWċbĢ@lÈVVkJVaVW@£UƏxW`£ÈVVÅlWXÛlW°b²la@°xnÞVÜĠÞ²@l°Þ²èkbl@xÈx@Ġènal£nUÇ²@ÞKnn¤@¼°U¼nVXUbnĠUVbUlV°LX@lVèÜUnK@_yXVyUwmIU»VkÇ¥ÿkkV¯m±n@n¯ÜanVVÆz@bwÜbm@wa@kmk»@a@VUUów@nb°mXmnVbÞVôanwJak£lwLÅnÝ@wl¥IÇÓ@UL¼kVÇÅó¯kVmmw@n_Vn»°LÅ»@éÇçŹīVÇÝ@ÝğUaVÝ¯ķlŭġl@óÞÛċ@¯nkUÓm±IVġUwóKUn±¯Kw»KÝVnl@óxUwţ£ĉUmÅÇÝKÝUlmK£UV@ÞÈW¦Ò@Ĭnny@nÒmV¼@°Vbl@VlnUUwl°a@@llnk°lbnKWĀnUVxU²Åm¦ÛÇÅaUVb@¦m`móXUmmxÅ@±Þnè²U¯»mVm@wU@wÝÝmLa@VÇUkl°¯VlkV¦UmxaULUèVx@kIUxmWV¼¯VmÈ¯UnlÈ@m»ÅVWxÅbÅğW@km@kVV¦mlnn@ōl¦ÅÆxk'],
                    'encodeOffsets': [[
                            102466,
                            28756
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5107',
                'properties': {
                    'name': '绵阳市',
                    'cp': [
                        104.7327,
                        31.8713
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ńlV°@ŐĵVX»ÆUĊÑJw@È»m»£°Kk@ÇnÑÆ@w°JUwnw@wbVb@VlźLUwa»aUklyUUVakwWXwWUxkLmn¥mwkUXlJw@aIk°X¥W²l¥aUIlmkklÈL@m°nlWUaW@V@UaV¥@ak@Çk¹K@aK@kKkÇX@VU@kx±VèkIWwUVUkkKÇ@a@wkml¯@kUWn£WaaVwnaVÝw¯@UaWxnJÅUxUma@L@mbUU±VVnkxUÆVm@kkKW°X@¤ÇUkÆÇnU¦¯kmLVwÅK@UóbÇÆV¦L@±êX¦mVÞkÜÝnWU@k¯wķn°ÒUlln@@ĶmnkĊJ²bVlxÞbÞbk»mn@¤¯bz@l°UÒ¯È@xŤXyV¯°¥Uww²XlºVŚ¯¼nx@XÝmxnb@nJ@b'],
                    'encodeOffsets': [[
                            106448,
                            33694
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5117',
                'properties': {
                    'name': '达州市',
                    'cp': [
                        107.6111,
                        31.333
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Uxn°bnlUnÒÆnn@n¤LnxlUV@Ælx°XXxl`XVWLè±nÈb°b@²x°KÜ¼°ĉV¦lJnU@¦ÞJÞğmLÞ»xUlbVÆannalVÆX@lnŎVmUmaÅXa@aWm@£@wĉJVkkkkmnk@mna@alKJ@ÞwmÅÅ@ambkU@KUġKU@mak¯±a@aĉÑÅaVwXlw±V¥l@@ak@@£mĉÝónWV@nÝÇÇxUmbaVkkk@m@m°ÝýXmakÅī@@mb@@xmnb@mxkWL@¯b@WUXmWWKkbm@kxXmm@LUlxlêóKnUallLlLó°m¯JVUK@xK²Āô¦l°'],
                    'encodeOffsets': [[
                            109519,
                            31917
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5108',
                'properties': {
                    'name': '广元市',
                    'cp': [
                        105.6885,
                        32.2284
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÆLĊx°»Ŧ¦WLÈ@xÞKÜ°ÞnVxÅĀlÒnJ°a@wV¯l@XWknKnwVÈ°XXalX°VI°bWna¥@w°n@yÆ@nkÞ@°¯lJn°IÈlUlXÅ@ķlUV¥VUUÝÞUU@UwJUkĉm@ýlkWUwVwWJk@VUKlUkaVUmLkm@@UIk`@UmlUkV¯ÇXKÝ_mm¯@U`kwml¼±KV¯¯Vk±Vk±kzmaKUnÇ±bk¦±X¦¯WlJ@bxkIWVlxnm¦nlKVwXWxXlxUbVVkzVlb¼bVxŹKUk@Uaa@xmxVx¯Ix@ÅmÒ@Èl¯L¤n¼'],
                    'encodeOffsets': [[
                            107146,
                            33452
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5118',
                'properties': {
                    'name': '雅安市',
                    'cp': [
                        102.6672,
                        29.8938
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ln@xèVInxVKnĊklxkÜVÞÒnÈm°nx@¼ĊLVnxWXblI`@nmĉnKČôÅlUÑmUK²¹@ÇÅVÓÅ¯VýÞWUVmXÆbnwKUÿ@UmmIUb¯¥Uw¯ÇmçmanUm»UUlk¤a¯bVU_WĕmÇÅ±ĢUlUlÛVçkU@W¯KUVkUağVmaVWUmV»¯@»m£mÝL±@ÈmVk¤mb@ô¦kVkamL@b°@b¯¦ÝVn@lêb@ºUĸL°J@zV@nmUlaĸÔ@x°VÒUbóĢÒWkV@Ò'],
                    'encodeOffsets': [[
                            104727,
                            30797
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5115',
                'properties': {
                    'name': '宜宾市',
                    'cp': [
                        104.6558,
                        28.548
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VlÈnlXnWLX`m²nV@b°xĢçlnVmnn@@°UzlV°nÞÒkxlw`UnVbmL@albÞKÈÛmÜ¼°@XÇ@wmW@ÅKĊLlVLVŎçÞL²±ğkw@Uy@¹lKXlKVa@wČ@w@aÇU¯n@@wġakaōK@Å»VakUWmķwkbğ¥mLak@ġÞ°¯xVVÞ@VxVVWxXlxU@k²WVÅULmèULVĊklĠVJVx±nÅ¯¦mwğ@mlğkkl±@kUk@¯±ÇKkxl¤bImx'],
                    'encodeOffsets': [[
                            106099,
                            29279
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5111',
                'properties': {
                    'name': '乐山市',
                    'cp': [
                        103.5791,
                        29.1742
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kVkÆkV²UlºÈIlxLXèÜlUXUmkbVèx°@@¼°Knnn@mÆIUbnJ@bVI°b°±@nK@mVakkKl¯nbmĸèl@VnÈlUUwwmwnm°¥LlLnU@VaImbkmKnk@mbLVJVUUVnkVmb@a¯JUaÆkk¥IW¥KlwÑmÝU¯kVy¯@@mmnUkmġè¯w@aU±mnW_XKWmkÇmUkóbUÝUanmW¯nma@xVôUV@b@l¼n@lb@xnÛaxa@yUÅmUÛbm°@mn²U°llĀÈ¦lUV¼nJVxUzWz@`mL'],
                    'encodeOffsets': [[
                            105480,
                            29993
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5113',
                'properties': {
                    'name': '南充市',
                    'cp': [
                        106.2048,
                        31.1517
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@È²VmLnblyl²²UUl°U°²L»knlx_V°@nnÞ`WL°ÈUVlnkV@l_JV@n@lnKV£ÇUV¯m@laXUUbVx@VkôJU°Jn@wUk°wnUV_nJmknmm¯Vwk¯ó¥±ÿL@wLVUkUbX¯mykI@a±Kk¦ULmaXVm¯Kz±klUIVbÇJkL¯lUÿUlUkJUmUUkVVklKk@@aU@J²x¦kĬ@¼±ºXnWbxU@xx@lL@bLlº@Èl@bU¦Vb@U@XbVkX¯m@nÇKkllknJV'],
                    'encodeOffsets': [[
                            107989,
                            32282
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5119',
                'properties': {
                    'name': '巴中市',
                    'cp': [
                        107.0618,
                        31.9977
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VUlbkVVLUl@XIUxVxXkl@þĊnVlIVx@VVÝVÞUVU¦kV@ĸWÆô²@VÞn@Vaôb²W@K@XUmÑUW°¯°Ina@y_lWn¼lLUbô¼Kla@nkUyôÆx°@n£Ý@¥mVkIU¥Ċ¯Û»¯L±w@¯aÇa²mçKXUWk_Ww¯WwÅk@UkVmwK£@mmmÅmÑkVmamnnlmIU`Vm¯xVlx@m¯IVóIUl@UwVaVWkb@nU°VÈU¤'],
                    'encodeOffsets': [[
                            108957,
                            32569
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5105',
                'properties': {
                    'name': '泸州市',
                    'cp': [
                        105.4578,
                        28.493
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VVXwVKnwnVnl@b¯xmKUbVn°°X°@blLènV@Vnl@ULnmmUnaVV_ĶV@wnJl@@kkKVólaUwnJmwUlm@aUaôKVnJWbÞ@VwVLX¥VV_Þ`wWÞŹmmnIn¥W@kWV¯@°kILk¼Ç@k¤±XknmÝ¯UlÅÛKWV¯klUwkLÓ@U@w@ġXVWX@UbVbV_kÇVlU°lnwŎ¦ÞaÆ¯nmm¯Um¥nkVmkl_ó¥¯UÇl¯@Lk`¯ķLUy¯@mw¼ķ°ġ_ÅU°mlnÇVUÞ@_JUnVUXblĢb@x@mV°Èb@xċ@@xUbkLWkL@ºzV@lxĠ±²'],
                    'encodeOffsets': [[
                            107674,
                            29639
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5101',
                'properties': {
                    'name': '成都市',
                    'cp': [
                        103.9526,
                        30.7617
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°n°m²°ÜUw²ôV°VkxÜźUŰČbĢlaÈL»@kwVÇ@nÛÆ»ÈUÝ°Kl_V°U`Vbn@VbÈLaVU@ƨ»VnIlUUa±lIk±@VnKmÅ@WaK¦lVōkKÝ@maXÇmw¯IU@kVwUmVIçÿU±Å@¯È@xK@wLUbÇKÅ@mÝ£@yóUóóUxkI@WlIUabaVĀLmxÅaWUnVÝXUþÆ°UÔÈÆ@±ºLnVVÒkóÆ'],
                    'encodeOffsets': [[
                            105492,
                            31534
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5120',
                'properties': {
                    'name': '资阳市',
                    'cp': [
                        104.9744,
                        30.1575
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@èUJVnxU@lV°JnxWÈnbÞ@lLŎUk¥LXbÆ@nmLU@zlbXmlnVynLçJVbUnómUnamUan¥lKV_²aValWôn@nbVK°¯VblW@kklUnlV£°W@wUXk°KVwmVkwVyVI@wkmVÅ_Umm@Uÿmbk£xUaVw±V¼V¤kLWxU@UkbyXóm°V@@zÝÒkKn±U@@_VVkÇaVwnLWalm@@kkVVl¦kIV`±n@wKk²aVUUV¤nkxmUkVWVnLUbVb`kUUmLUmX@`ÅbÇXbWLXn'],
                    'encodeOffsets': [[
                            106695,
                            31062
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5104',
                'properties': {
                    'name': '攀枝花市',
                    'cp': [
                        101.6895,
                        26.7133
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@bKÞnÞ@xV@xnUn°¼V±mç²ÝÆ@wnnVWnôn_@¥UaVbÆÈÜn¥Æ±VUwVmXÿmLkal¯km@k@¯bkVxmVUkk@Ua@¯»UnmÑ@mzm@īÑX¥Ç@ÝxU¦ÅÇUkx@lbUWVXmV@xĵĖ±@@¯xUÆLnÆmx@nXL±lUUVwKWak@WxkbÞĉbUn@@@xó¦Ŏ'],
                    'encodeOffsets': [[
                            103602,
                            27816
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5114',
                'properties': {
                    'name': '眉山市',
                    'cp': [
                        103.8098,
                        30.0146
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Vx°¦VanJVn@baVbkJ@XlJVwôôôV@zÞ¤@nÆÈLVaK@xL@w°ÇÆ@²VĀmWXKWaÈÆa@_nWVnKVlV_UaVamKXUWwnmmwÑm£@ynUkWĉUkWVkkV±çkJmkKK¯¦mnnxxVxVÇkUmk@çķnmak°LllUb@nmL@¯²¯aUJ@amIVaÅJnm@mm¯L@»¯@wUçanlVWVÛkWçKkwÇJk¹±VUÅlġV²ÈÆnXĖV`U°ab£lkVVn¼mVnbèÈn°'],
                    'encodeOffsets': [[
                            105683,
                            30685
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5116',
                'properties': {
                    'name': '广安市',
                    'cp': [
                        106.6333,
                        30.4376
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VlIVkVĀVk°lKÈIUaVJlk²yLn°UWnbVKl¥²L@blJnzW°alV°Inô¯KkKkkbVmôLkéwVk@KnnWlwn@laXLnXVW@X°a@XKlnw@man@w@na@@wĕġġwUkUWb@mk@¦¥mUÛb±yÅn@bml@kV@lknVbmVnlmbÇk¯bWyk@V_UamJ@I@WaVXamIVWkUkbVaUUx@VnkVU¼bkKUxmK@WxnV@n'],
                    'encodeOffsets': [[
                            108518,
                            31208
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5106',
                'properties': {
                    'name': '德阳市',
                    'cp': [
                        104.48,
                        31.1133
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nUW¥²é@K¥UÈÅôa@VÆLUxnKl°V¥ÈmlÅÈV@£WX¯lLln@UVÅlwUm²UVVna@@KnbVVwÆImXwWkIVwÝĕVUaIèmKUzkmWnka@y@l²kJ²VbVkmJUƧ¼@UVbÇKUam@Ua_¯VUk`¯LVÞÇÅ¼mÜ@UÈx@l¼ÇKkbWVxUbÆ¦nxÆ¦ĊV'],
                    'encodeOffsets': [[
                            106594,
                            32457
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5110',
                'properties': {
                    'name': '内江市',
                    'cp': [
                        104.8535,
                        29.6136
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@²èlUUllXĊVXlmV@zn¤ÒnxmnXxlUnVlwmU£VVUbl±L@x²mU_lJ¥UklU@ln@kXbmKUxÈblUU@`V@²mlLÞÑ@yU@¯ônWzaVlV@XwlKU£»aVaUwm@mwUVUwklVÇ²LlKVm_@ykUm@mUçkKmxkIUÝ@LUJ@n±kºLXb¼@mmIXa@mamnkWKUx_U`UklwUwmUbV²akbmkn@`UmÒVxUbI`UaÝÈ'],
                    'encodeOffsets': [[
                            106774,
                            30342
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5109',
                'properties': {
                    'name': '遂宁市',
                    'cp': [
                        105.5347,
                        30.6683
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÞĖUxlJXVb°@xUÞmbUxbXbm¤VX@lk°ln@xbÈ@lLVlVUXxlJç²UlwV@@UÈWlLw@wVwXaWm²¹@»lī¥w±I@V@bl@kLUllUVVn@mmUwXċbVb@VUkbmamW@ka@k@laUa@¯b@mmwó@@lkXUa¯°LUamm@ókXUb±bU`kLm¦bnVmbnVmô'],
                    'encodeOffsets': [[
                            107595,
                            31270
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5103',
                'properties': {
                    'name': '自贡市',
                    'cp': [
                        104.6667,
                        29.2786
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lIÞÇbV_JVaUwnÑV@_lmnlab±UVanVxkxVlV_`wVLlXnmnb@WbnJ@n»WaKl¹²@mVI@KÞVlJnw@aW¯¯¯UmVanL°w@akmmUxmULWxUUÝKōèUKUkĉKL@ÆnX@xWÈ¯@Û»nÇÜÝLka@bKnUaVm_xkLX¦Jl¦ÅlVb°I@bnaUmlUVUVIUKa@nmlnLlnaJUbV@'],
                    'encodeOffsets': [[
                            106752,
                            30347
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/tai_wan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [{
                'type': 'Feature',
                'id': '7100',
                'properties': {
                    'name': '台湾',
                    'cp': [
                        121.0295,
                        23.6082
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@\\s@pS}aekgKSuSsMß`¡CqZ·be@Q^o@gieMp]}}Ľc_Kk{ùA¡r[uom@ÑĥJiq©mŉq¯Bq]ÙYgSåk_gwU­isTEĕiqiUEkue_OSsZaWKo¡­qycY£w}ĩĕS§Z©SN¥SyLÑ¡±Ks^IYPdY[UoFp}´\\¬\\j]eÜò¤¡ā a\\bnUãº¹Ìs¼j®[cíȈEĝĆ`ļf¶®K|VØDdKGpVnUFjpHF`B[pMºxÖjbpÎxp¬|ÎŸÜÒC²®ÜApZG~dÞàV¨|¸`|²tx~\\~|dFf^zGĄŚhdL\\hĸ¼OªP®lV`p\\]Xpllæ¤CpQ|oF}fMRiNSon_²qämMNM\\'],
                    'encodeOffsets': [[
                            124853,
                            25650
                        ]]
                }
            }],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/tian_jin_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '120225',
                'properties': {
                    'name': '蓟县',
                    'cp': [
                        117.4672,
                        40.004
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@EUDAEI@WNMNCBFAHFFNACDJDPBD@@GD@DIFFHEFGDBDEQOFG@EI_KG@OcJQM]RMEKBGPG@[LaCIICBWKCEEG@WBQHCDFD@HSLEJI@IHWECFGAAEKCGDBFCBSBIDCKKHEADMJMFABKOKEQAA@IEEG@GIQAEK@OZEESMOLlu@SLUTYFQCMG@@SQUAYKAACA@IB@BDB@B@DC@@BGAEFAA@BEGKJCC@AGAIHA@@JC@QEIP@@A@EGIDC@O@C@@@@CJCWKABFLBBEBSQGBAAMIEM@AKBcJEN@BEBCFMAEFEF@J@BG@BFABECKFG@AFQ@@F@BEB@@A@@AAAKAE@GFGDECEFEECBKIKDELDFEDYH@EIACDCHKBEB@BAAC@ADBHABKJIAIJICEDGDCD@@A@A@DHCHJHDFEFGBKRKBGIK@GIMHSBCH_BOJECCJCFKKMD@DNJEDEGC@OJCJHRUL@HRJ@H[DCNKDZHCTFDHCFFKR`TANVDFZRDLFARB@HPAPG`ILAR@TERNDFNHDLCLDDCXDYbHF@FEB@LDDVE@JPNfXPINCVDJJD@NJPAJHLXHDNANHhB@DPNLRMTBFRBHHr@`NBFEBOCCBIAQJDHCHLHFA@HSDCRLFTB@HEFLNF@PELBDJALFLTC@EPFLLP@tUHQJDfIHGTB^JTCPDLKAIBATFPADIEGECEMJ@JIAIHGECFEAGDI\\SPOXAFCL@BQTQBBTMZECYGAHA@GJAE@HCAEME@IECFKJADDBABLTHHG@ILEAMNDJCDHEBF@@JNFJELDFKTOT@JETBFFHBHEHKI@@IJEJ@XKEOUMS@AF@CEB'],
                    'encodeOffsets': [[
                            120575,
                            41009
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120114',
                'properties': {
                    'name': '武清区',
                    'cp': [
                        117.0621,
                        39.4121
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@FWôµ@IFCLIB@EHNBp]AGEAKAEDMGZKFGBGME@ILGP@HEFB@BXMEAHUGC@IHCLOD@X[NWHWPKAEF[@EKIOL@EKGBNMJ@EIEHKBIC@BAKMIACCFQZCF]DB@ERAKADIHGEIBCGIIECFaGLZO@EFCNGAGDGAKL@BMG@IE@ADSDEH[JGC@CGA@BMDeK@EIACFE@@GG@FIAMM@CCGC@EM@ADE@CFMAAGHBDKIEAJG@DOGCDEKAGIS@KFCHKAEHIE]BeKNO[IFIOELC@A]GMBKVYCDDgGAICARc@MW@AQE@DGI@@AQ@@BKBAIQQYEFW@CEADIGGBCEIiMEMF_LGEKMBBDWEBGRC@E_CHYGCH_IAED@FFBQh@FGJaJ}AHRAREF@bE\\C@CT`FHC@\\BBF@BID@HGDDJ@@FAHKBARECKDAZBJIVNHCTA@EREAMLHDAFFBVFFC@RNRETHD@FOJMACH@CAB@P@DF@@FGDWE@FFSIEMKQDYCCHKb^JADOCIDGNDBdBCFJB@EC\\A@BJEA@JAAAD@HHD@LFBCFF@BERDHNhZQHMBGHOACCEBWEGD@PSJKCGEUD@CINLFGHE@AJK@HDABBHTB@F`DBFLBBHEDARCFG@ABJBAPVFE^FBGLGCFG_BMLEXGAAFE@@JNRVJHFALFBEHQJCTbNDHCF@PlFLJSXCHFHfVBTNJ\\BPJXC^FAVNFCHFB@FFH@JF@\\ABCFD\\BDMCAAJKQBGAILOEGHILECQLWFENJHADC@QxNHFJNLDFA@CBA@DUÂmR@FBL@BD'],
                    'encodeOffsets': [[
                            119959,
                            40574
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120115',
                'properties': {
                    'name': '宝坻区',
                    'cp': [
                        117.4274,
                        39.5913
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@TZbB@JHD@DODCLM@AP@LL@BNH@ETFN@`E@DNG@CHLBCJA@AICFKDDBKA@\\N@AFNAGRBFjFFFL@DHLBLFQPcXAZMJ]GAVHAIZJFNE@JpDRRDCLFDGXA@EFF@CFFPDfEBDB@DCHCFCJDJIJBLI@I@CB@@ADBB@FALADGDC@@H@BB@FZGFCCE@@FMLALJDAFFFEFDFCB@@AHCF@L@@BBB@BB@FC@E@@R@BEL@HEFD@G@AH@AIB@@@FEFEBALDDEFAFO^IF@JCBBFPNJJ@D@PRDCEKBAXL@BIFD@T@JE@BHHJORFDI@@B@JGH@@B@BDDLIFFHCD@D@DEE@BAAAB@DAF@B@H@NGLJLMRDNMfGIEPMI@GDAKK@KIDIJ@GE@CFDN@FE@GFEPGV@TCDFKHBBF@RW@DD@@ID@TJFKIKLI@EP@IGBCLAEKLEN@KSHIGYACSD@SEAMBBMGEBMQBCMIGKFB[D@HDLPHDBC@IFITDLG@IIIFGVBNJDLN@VIRI@YIAIHIC@CLKZCBEE@JECEIHEAKGDGECBGEEM@@DA@CCCBBEGA[GEDBBoNAAH]MKiIAWKQoIIPMFQAEEDMH@FMSUYIeF@EK@BIOEKJEBICFKaKPFAFSE@LWCCFMHDDEKESBOGBKIEIODLG@CCDEQCEDWEMDIEIB@EHGEEDAEAa@@HqDEJGF[AECCFa@WCEIKAAEQB@FCAE^YDERDDJBLNABD@AJGLJF@FNIAMLH@FPKLJ@FE\\BFOLGXMXW\\C@KPGD@JHDGVFBWN@AEAGFO@KH@JNFAHEHYLNHFCLBFBBHo^MAFGA@KJED@Jó¶EX'],
                    'encodeOffsets': [[
                            119959,
                            40574
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120223',
                'properties': {
                    'name': '静海县',
                    'cp': [
                        116.9824,
                        38.8312
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@NGFMDATCNDR@CCbINEHNJA@C\\EEGVE@IhE[wepc¢·²^QEKIEKIgiQDkehY£uSDBMkUDOJDHC@GF@CAFBFEN@CQ@BeP@@G@HD@@MHQKi@[IGCOCESE@GMA_OcCGDu`a@VZzKDkJBLNXGDqKEWE@cFEFA@ISIi@@KMABJGBcMuFEzGVH\\ATSEUBeALCEMG@CEBUHUCGXaBPtUBBFIBFTDFF@DDKBFNGBJPHXDDMDCLJ^mBIHIL@LR\\@LCR[@@z@NFD@LLBNb@RHDBNTPT\\F@BJF@BXCFBHHBDLFB@HODADE@@JHVXCPDHCFTLBBFNCDCCCU@@GAABEHHZHBCAEdEjFDD@GfD@DXFCHF@ERFDLBH@'],
                    'encodeOffsets': [[
                            119688,
                            40010
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120221',
                'properties': {
                    'name': '宁河县',
                    'cp': [
                        117.6801,
                        39.3853
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@BFLBFJXDb@DEFD\\BHEFIrC@Gb@FBCBFFGH@FJAJFNCXFFCRDCFDDH@CKJPJFALPHTALFCFGCENDDKXF@ETEBObLELJDFALIPFAJL@@FfEZJTVENG@CNFFRBNEJOpJLRBXjJNLG^BBpMAAFC\\HHBAFDADDB@@CN@FFAHFDCHLHFBJGFCFUNKJJTD\\XUXF\\^F@DDDQXXBRLRCBDFEVCDLVDpUl@LEDJHAPRFGL@CETGPBTCDDVI@CFF@GFDCCVGLKEK[Y@MECISG@BKNSCGCKWEAaEBEKNGFSECO@GGM@GYI@DÅCMLHPTF@DJHAVVNKEGDETJ^[TJNNd@NOAMFYJ@@GFANDPEJB^aOadSTQSI@MHBDIEOKCG@EEFCKCqXO@@DMFENCDDHCCGJ]AKFoDaGGHYFDHKJiCMFGC@EQ@AEHGAC@IEAATKOHGIC@IXIFEoGE[JCFCDHNmRADFZMF[EEBMO{GU@AOW@@]ZeHBDEHBKEfQkuIWBs@EC@d[@[^EDMTKCEEcI@cDAB@FCBCACmOCG{PYHeBgPwPFDDALFFFCHQGSD@BHFAR[TaFYXMASUiGFL@DQNCJI@@D@PLDN`ETEFIGMCGBCE~CAIFDPEHGEQPHJADFJGHCJLB'],
                    'encodeOffsets': [[
                            120145,
                            40295
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120109',
                'properties': {
                    'name': '大港区',
                    'cp': [
                        117.3875,
                        38.757
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@JFFL°_`ONJKDDFIFZN xlb~yFVNRrdJGzDPVFBCTNND\\UR@E`F@@Ip@IWGUoawOEE@ÏDgK{İEEMFëCb@KwOCDHHKBDJCDEEEAGHOABFABMCgDLSQ@CFEBMgYIDQINE@AUSwSAdYEHQMEyK[KI@GRMLE@@OqOoBOnpJ@BmEAFHL^FDB[C@BBDVFAHFJENB@sNEjQAMYsUgCSBGDJH@\\LjGR@NC@@G@HO@AfR@DM@EFEADBE@@HGDICCPlVANTC¤vgZlfRChjLJ'],
                    'encodeOffsets': [[
                            120065,
                            39771
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120107',
                'properties': {
                    'name': '塘沽区',
                    'cp': [
                        117.6801,
                        38.9987
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@|ODHnPBDADEDA@CB@ddJFFLDNSFC\\]\\@@cFD@nACOMW@M@ITURBRZNHNWRQoOj½fcqAqeiDÿÍyÓįFL|Ch@ÐFFxPpbHVJXo@@JCTR^BPABQA]^MB@bE@@FQBFVJRH@FXtPNZSBAja@@NDTLJrQTHFXZFB`'],
                    'encodeOffsets': [[
                            120391,
                            40118
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120111',
                'properties': {
                    'name': '西青区',
                    'cp': [
                        117.1829,
                        39.0022
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@LHAHRHATh`LHNHDG`HDGZ`D@FQDAHXFACNAFLVRTBFOfHDCVBFQH@HSXHEPFB@LDBF[bDbLFKJBFLADBDjLvCPEI]FGEIGCBEUSjcFiBIVWfaHCjN^HtwBBFGPBJGjFBEGECGDONMFAP]TDHQOWCMGAMHKIJEIGQ]aDlUG]VGEGDC{PEbBZmE@@GH@BCA@FMQCFMYMJECELCMI_P¯`]R±¡¸odfx\\gF@JUFFH[F@DIBGMMFaJDDQ@MCSDCBENMH'],
                    'encodeOffsets': [[
                            119688,
                            40010
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120113',
                'properties': {
                    'name': '北辰区',
                    'cp': [
                        117.1761,
                        39.2548
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ROHFFGCOJEDB}DFHANDJHFEFSM_KC@O@CJ@DIRM@CEKKALFKACHoLSJSIBETDJaEIIE]E]K[MYUYQILC@GF[MGNKEK@A@BCWECAIFEFYAGFOMI[OFuDiKACBCEKIAELaKaCE\\CA@KEAFOWGGTG@ERUACDeGEPSAUQKHE`FNjNFJADHHCJFB@DEXZFRRBJLA@AR@@BJ@CHF@BRX@@NQdDBBJhHCCZDLUNA^H@BKDPFEJ\\JMPfL^AJFFGLBDGLET@HJLBCFHDCPH@BIJFCLGABHNBDEF@BCN@@FHDDDN@BNEJH@@HF@DEJB@FfLNC@AHB@DHD\\IFGTCBCF@@JNH@ALKHBHCHBDMFEP@KYbHDEJF'],
                    'encodeOffsets': [[
                            120139,
                            40273
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120110',
                'properties': {
                    'name': '东丽区',
                    'cp': [
                        117.4013,
                        39.1223
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ZV\\N^L^FJFFJIbSCAFTJTIpKDGLBEKLBjHTVNBZWbE\\SBQGE@ATCRHDGEEKECBECxOhOfAZGA_YEEWSGqRKISC@Mb@BiTAMYsOEWG@IQEURA@EF@@acUOXQRYCUDCHDTEF[SUEgAYDcVGJM`iAWDWLQRMHUHgDsDBLHJFCFDFGHBFFVEAGHCJN@RJFPIhBD\\FENCPWA@LFBAFHBEJUEARCDIAEDQBRNa^'],
                    'encodeOffsets': [[
                            120048,
                            40134
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120108',
                'properties': {
                    'name': '汉沽区',
                    'cp': [
                        117.8888,
                        39.2191
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@LMEI\\MTABKN@FCDMH@COAcH[AoēAM¡Wa[MeqpQRMXMGQYQASV@J@NNXDPmBAtJXlveRLFGACFGAYf@^X@BPV@|HNPFA\\FNEEYBCnQGMDCDE\\IHFpEFWJ@JJDGHLPBSFB@JBDGHBFR@@FHDNEjDLICGZEHGbHpCLE^BHIDDCGDCFMNE@CP@rWLDEDFFH@'],
                    'encodeOffsets': [[
                            120859,
                            40235
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120112',
                'properties': {
                    'name': '津南区',
                    'cp': [
                        117.3958,
                        38.9603
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@TLv@CNHFFBHGZFETNPhCVGNGRQXKXCjBN_HIdUZChBVF\\TFECSDGVCZDRQPWdVNA^]RBBAAOQ]DSE@F_Q@[VMCSMADUECOHycIqMQEU}zkawENRDENB@ADG@@HF@YnaAOF|CDFHUHH^kVbCR^JHIFLJNGHBDNPXGRSCO^EBMNCPDHHFAFiEIHOAEH'],
                    'encodeOffsets': [[
                            120045,
                            39982
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120103',
                'properties': {
                    'name': '河西区',
                    'cp': [
                        117.2365,
                        39.0804
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@d@hZNFdcLYXKRCtCMOFSYEGHEAGEDMu@SKAAsx]GMTGt'],
                    'encodeOffsets': [[
                            119992,
                            40041
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120102',
                'properties': {
                    'name': '河东区',
                    'cp': [
                        117.2571,
                        39.1209
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ZBVFFIGABEEA@KXBDOFM[EACJgOIE@QIMGDBHUFEEGAEHECEDGIAKQDWLKZcdQPEP@FOFBJTJ@HNORJf@DBCN'],
                    'encodeOffsets': [[
                            120063,
                            40098
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120104',
                'properties': {
                    'name': '南开区',
                    'cp': [
                        117.1527,
                        39.1065
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@NMVDCG\\E^B@HlB@YEDS@CHsNSiMGDebUXAJEjidVTAFHDFJ'],
                    'encodeOffsets': [[
                            119940,
                            40093
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120105',
                'properties': {
                    'name': '河北区',
                    'cp': [
                        117.2145,
                        39.1615
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@DBXFADB@L@LFHM\\NHED@JKZRb]QMRAFCJBDCBQYADMCAe@QIMP@GSIAIPE@E[EGH@ZEF]^HJAXK@KF'],
                    'encodeOffsets': [[
                            119980,
                            40125
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120106',
                'properties': {
                    'name': '红桥区',
                    'cp': [
                        117.1596,
                        39.1663
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@J\\PNHEZBFEJELEL@BWGI^]FEkA@G]A[FDHUCMNEHJ^'],
                    'encodeOffsets': [[
                            119942,
                            40112
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '120101',
                'properties': {
                    'name': '和平区',
                    'cp': [
                        117.2008,
                        39.1189
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@DT@FCHG\\FFOROMEgYc@'],
                    'encodeOffsets': [[
                            119992,
                            40041
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/world_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'offset': {
            'x': 170,
            'y': 90
        },
        'features': [
            {
                'type': 'Feature',
                'id': 'AFG',
                'properties': { 'name': 'Afghanistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࡪ͇وŐǬϠڐŶӂʮǚڦ۾ǌƀ̚ІɣʪҴMوǯʲĹ،˒˰ǋ˖ϪԈiżŬĘͺβ̈Ҕȏĝʱʪ¡ý۷ͪ˟̊ǰώĊԼϖׂ×ࢀAƬʋӧĥяƹ७ĭࣗǭӫλȤΣĪллΛ͑ɳ̡ߛͦ։՗ɅΥԕ²ԋ͡ɿ̳þٝŋğɻسDҵӇ܍થΓבôǝȁԇņ࠿űටіހހåզُƚßՔ˟ڢάҢιŮɲؒ΂ਸ'],
                    'encodeOffsets': [[
                            62680,
                            36506
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'AGO',
                'properties': { 'name': 'Angola' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ȸصʌԋȘ˕͐ѯ֊æˤŠҬşŲɀɂӨԶ®ƤіHñ̡৴RfՉǞ͕ūԑÖԫ˪̷­ৃȼüκsԴŴϦ¹ĘʹĩСƨϿů̿î́ყZᦵ֤ۋպԽ໳΁᎝Š׋Ж₭ŵÏԃϞկ~ԉƝЙǅÿՈŜ݊̂ޒªΰ˚ݶȨΆӘռːϐĘج«ӊʣ̜ɡԚȵԎ®Ǩʶͬʭ߼ǣ֚сՐĄǎΌŔʒg̎ĸៜ['],
                        ['@@ɉėɣلͼδʪƘ̀˽̩ǯƍɍλ']
                    ],
                    'encodeOffsets': [
                        [[
                                16719,
                                -6018
                            ]],
                        [[
                                12736,
                                -5820
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'ALB',
                'properties': { 'name': 'Albania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ń˷ŢέΒȳiə˗ŧ»˙ϷСƛÐgȂү˰ñАîֶŖʼƗƂÉˌθаÂƿɨôǴɥȪďȨ̂'],
                    'encodeOffsets': [[
                            21085,
                            42860
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ARE',
                'properties': { 'name': 'United Arab Emirates' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ƭ¤ɱڂƂ۞uԖ{ֺ֪ظՠՎԮǆ˹ŖڑѕGçճƪŝϝǑE΅ʓΏuͷǝǱᡋъ͏࡚Ț'],
                    'encodeOffsets': [[
                            52818,
                            24828
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ARG',
                'properties': { 'name': 'Argentina' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ߗ§ѓ̔ԑx࣑@Aሞ͒ϵрؿનԋ୲ȿϙп'],
                        ['@@Ӵ؇͠ڰॠƊǷ໶ോۊŷਆاࡾ͡Ŧχࠡ౧ࡒɭ़ŷڔƈނ٢Ǝݐжǈфӝiڣۻҩ֟΁ॅࠃ૭ଧȽڥɣࡹT࠷ǽȇÝիËѫ੨ܙŗ׃Հν§Ч߯ઁఛ҉။ǩउĎǰԅǣػƺщԋ̏ࡱř̪͕߱ɗŜ࠳֨ʧҠˆʢѧޛʻڭԹūࡋȣ҇ߏEڃљʋؿؙࠞߦǝ˿ݭ঳Ӄձটލͧ΅Ͽ˔ࢍ֔ӡΟ¨ީƀ᎓ŒΑӪhؾ֓Ą̃̏óࢺ٤φˈՒĭьѾܔ̬૘ěӲξǄę̈́ϵǚˢΜϛ͈ȝॺ͸Ǣƙ਀ȠࡲɤݢԊ̨ʭࠐEޚَոo۰ӒࠎDޜɓƶϭฐԬࡺÿࠀ̜ބռ߂צԺʥ͢Ǭ˔ඔࣶд̀ࢎĹɂ۬ݺશȱ']
                    ],
                    'encodeOffsets': [
                        [[
                                -67072,
                                -56524
                            ]],
                        [[
                                -66524,
                                -22605
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'ARM',
                'properties': { 'name': 'Armenia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@୞ƀǨə͌ƣǛɁ҄˽ʁˋΦɫϘƏl׋̣}΃ӢHżχCʝɤǩuͧʖرȼĄФƛ̒'],
                    'encodeOffsets': [[
                            44629,
                            42079
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ATF',
                'properties': { 'name': 'French Southern and Antarctic Lands' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ը˃ߐĿǅɽϣಇÃq҂ŮΎÊǢ'],
                    'encodeOffsets': [[
                            70590,
                            -49792
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'AUS',
                'properties': { 'name': 'Australia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ߺ́ҜŘپǊԎÉÐঽ˽́ēگ̉ɰ׍בǧ®ԫԭܘŗֈӝܸtϬռõ'],
                        ['@@̢ڇբ̈́˦ΡЖ͟đϋǴܛŸнɄĹɬܕąѥ˖֭࣬ѭצЋ֞λŋȯӔՃࣧ͜ͲȂ;ηȴźƢࢹ׬ԩϸ͋ڀڹʀڭtӏËԳА܋µݓơϵɩݡjӕǕ׻χއثЭ̫ٱ˫гʝܧ͕нɅػŉׁªˇӕ̇वޡ·ϫ͙ԕέ۟ψԥƪżѬҝǃ݁؉ܩɪӉƄӑÔ߿ʐիԮƻْțьЭ;߱ĸˢРȯزЧ׉ݝƷѮҬŶӞ͘ЬãجہܑԿ˽͏ڛٽΊ~ҀԿ،ѹ̀ǂȘઃԚןz߯Цຓāછ̝ख़˫ߡÈࢻљܯȗǉѱ̳Ϳ܉qՅõݑƶ׿ğֽԁ҃ʕуʁЗˋؕ֛Bࢽ՜ҋǄlӖкŘƚȒ̠ĺאģӼѻࡖƏӒӎͭնsʚϋͰĽڄӓڔřΪτε˳ެиʑʞ͗aјеڎă˄țʦĠӠǢȸŘрęӮΎ؀Úٕ΢׀ۀˬЦΪٜ̰ϤàɴĻڎ̺ԚĤŶȀɞüҬoࢨʖҚώɊ҆ӲѐͲvҘט܎ΠܩΦǚ̗Ј˂ТψǻĸٖҠаȮͨцƜ`ɼτĭdɂτŦОŔبϫҲӽՂMՖÿǱҦДڪϜɘſȾκӒԘ̒јıۺǂeі؛ˢ҂Ū֎ȻҀ·ۼɋʈĐԶʵӬʊ͂ñȠǊϬеɡ͉҇ͻ˿Įͱʙп̗ЭÔʁڜҫ٨ˏѠ́؈ӻʂBѰɍŶʷߤ˵ֈ˼ǐҊǠόľҤʰڞŝОÔʔīӔŌنǈǠŽˬȮѾǆҦtʈ̸̾ʂЩÎՃȾķΛ̨ёÚӇ̥']
                    ],
                    'encodeOffsets': [
                        [[
                                148888,
                                -41771
                            ]],
                        [[
                                147008,
                                -14093
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'AUT',
                'properties': { 'name': 'Austria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Û΃ӁCǎǻ˧էǇƗܽsщȏۛÞயɐȉ̊ࠧƣĭǅԗŢѕxϝƶźȴƬʪ²ьɹŤɜݎ׸ƮЖ}ˀǣþƜšո̠ń̒ϰز˓ӀΆ̐ÚٶʱЂªϰǁãŃČ̅'],
                    'encodeOffsets': [[
                            17388,
                            49279
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'AZE',
                'properties': { 'name': 'Azerbaijan' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ʞɣψDGŻ΄ӡֽŒщϰƃ͆Ǫv'],
                        ['@@ϊËƞɈԈͺѴѵђ׭ϺʸɧۗãƣٵƟ̭̍ȝvзȽ¥ԻѲ̂дʝʚ̿×যإk׌ϗƐΥɬʂˌ҃˾ǜɂ͋ƤǧɚȶƎضʍҐ¹ŘĲбҔɔŚʀ׀ԙ']
                    ],
                    'encodeOffsets': [
                        [[
                                46083,
                                40694
                            ]],
                        [[
                                48511,
                                42210
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'BDI',
                'properties': { 'name': 'Burundi' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Á০ɃϢԜßʲӎҀÅ¸ͧǸȏT˗ȹǭ͛ѫ̧̥΍'],
                    'encodeOffsets': [[
                            30045,
                            -4607
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BEL',
                'properties': { 'name': 'Belgium' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@؜áުǪՐοҦȝħ֧ɕĝһܿϦћßדІϷͶϷ`ũ̒ڪǔ'],
                    'encodeOffsets': [[
                            3395,
                            52579
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BEN',
                'properties': { 'name': 'Benin' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ۛįȹ׆ኞǛǦЮ̇̌ʱʞņѶ̀ĨǠξЪĀȀʤˮʘ̠F٘ә˩ȎӽǓͷĘɧСԳʵʳǁՉt՗µണ'],
                    'encodeOffsets': [[
                            2757,
                            6410
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BFA',
                'properties': { 'name': 'Burkina Faso' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ֹɐϽ̍Ƀϗǰƥ˦ϙǾÅӦɮΤo˴ښۢŬּɲȴОœΚǢŘɎٴϖǆˀ޼ΒҦŢɀǇՠJáСŔϣӀչНॺȏmֻǿʣЩÿǟν˿ħ݁lϳâ˓ƉωÖร¡qӉŘم'],
                    'encodeOffsets': [[
                            -2895,
                            9874
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BGD',
                'properties': { 'name': 'Bangladesh' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@i׽̉ŶÆگʉѬµєǅКΕӨޟü΋˃ҳΧǠũƵʃĠ͗øŽۖ̅لƜԒԫɤȆ̪Հ̼؅Ѽ֮̔ږεВ£ô׏ߞřު^Ӟƛϯ܅ϕµʷӍҢѥƎ՞ɶFѶ೯'],
                    'encodeOffsets': [[
                            94897,
                            22571
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BGR',
                'properties': { 'name': 'Bulgaria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ʎΉ͚Ö٦ſ௾«иɌবȜ̩ؒӴĕѥΏ̫׹˔ӏܣŒࡥ˃Uлޅÿס̊ڧɱة|Ñ֊сːƒŢĝĴƘˌ͌ˀСδ÷̬ȸȐ'],
                    'encodeOffsets': [[
                            23201,
                            45297
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BHS',
                'properties': { 'name': 'The Bahamas' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ȵ£ɇӜ̿ʐǾՔʨۣ̎Jӥ'],
                        ['@@ࣷƅÏ̴Ђäֈ{~ɕ'],
                        ['@@ƟׯƷņ`ѮϓͪCĪڐϗ']
                    ],
                    'encodeOffsets': [
                        [[
                                -79395,
                                24330
                            ]],
                        [[
                                -79687,
                                27218
                            ]],
                        [[
                                -78848,
                                27229
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'BIH',
                'properties': { 'name': 'Bosnia and Herzegovina' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̦FȿσМ͓ūЃȡƽû˙țūҥݓ͈ͅΘ͋Ȅϭ̾ǻʺЩϾǬΒ̞ȕǼǨϾnܠƓ׈\\Ϟȅ'],
                    'encodeOffsets': [[
                            19462,
                            45937
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BLR',
                'properties': { 'name': 'Belarus' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@߼Mࣰ̈́ȚӄېːÿϔԜƚ͖ࣘࢮɁŢȻѲĴࠒȧĊЁǷɧՄս΂Ƴ»Ʊ֦Ʃʎɡ͝ǿڳǉÿȠ˧ȸ՝ܝ¹ʵȁÃхͭĆݷ¡əȞ̿ƥ́ŨڍjफȬࡕàٱmҡɩГeϐʷϴԌǢLͰɷ͌ϊ'],
                    'encodeOffsets': [[
                            24048,
                            55207
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BLZ',
                'properties': { 'name': 'Belize' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@OŮĸƴı̞ԔǄZHūǄGaɭƋεôŻĕ̝ÀăīщǓɟƱǓ̅ʣ@àॆPژ'],
                    'encodeOffsets': [[
                            -91282,
                            18236
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BMU',
                'properties': { 'name': 'Bermuda' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@OEMA]NOGNG\\Q^McMOI_OK@CQSGa@WNLVWHFLJXVFGJ`ZRTDLeeWKIHGIK@@[MQNi`]VDTBHCJAPBJLVFjT^LV\\RJZRn^RH`TfJjZHHOTTFJP_NOX[EYQQKMEJOLANJH@HQHAARF@ZEPS[U_IcRQXE@EEKKOCGGCQCOGISKYGUC'],
                    'encodeOffsets': [[
                            -66334,
                            33083
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BOL',
                'properties': { 'name': 'Bolivia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@य़͟گӳ؈વȲ۫ݹ؅ŗ͡୆ҋऺˆ߾ѳ΢ŏ؆ЫֲՌ࣢αۺȖ˰ƭ̶͠рh܎¤נǸ˶ܩഠزíѠnȈʪ݀;Ѷ͂સƚęؽļ͓ãࣰ֛ݫऴƑ̻ͦ֨ǕΐʑՈTӦʟӟǐʕZγʓa͒এྖūӟĜͧҞɽȤԹƫڋɯρĄӏʿǥaʶ޳јޭ^ัʓЕ݋sҋͥ৕ƉǸ'],
                    'encodeOffsets': [[
                            -64354,
                            -22563
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BRA',
                'properties': { 'name': 'Brazil' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@૮ନॆࠄ֠΂ۼҪjڤуӞеǇǒӜŖӼBҦ̡ƴ̿Ƌ̻į͔ýޔƿʤ֥ɪ΃ǏࢱǈÈଜʝҴˀǦăӐɰςƬڌȣԺҝɾěͨŬӠྕ͑ঐʔbYδǏʖӠӥʠՇSΏʒ֧ǖ̼ͥळƒ࣯ݬä֜Ļ͔Ěؾષƙѵ́ܿͽȇʩџmرîӃƟϡĪÈ౨ۏӷݏv҄ͅ֏¶ǲΰұԞΓݴɜƶA΢ԖʎċҔɊ̈Ôϼ०ֲێǊŔŴݴϚᘰpθſӔύ̬LؐӀƒǚē͐ӯĔYՀ࿖k˦̂ɸˉǐӷǂļҨѻٸÆǌʲشȞΊƐĮΤ׸ʆ¯Ǯ܅ðśՊ֞ϓɒǀþجŅڜȿʐȤ؀žल̮͎̾ŏʂѪȜȗŉσ̀ŵȖϷɷ̏ƅ܏ɌыÔϳԬϿЮ¥ĢǒˆϠƦ˚ɢҬíȲҚçøǢƗǘĎʐͺõЈĒӔǱξǥʺɪȊŘɿДÒ͒͊ʴؤӼޒ˺¢ȺҫҼ฽҈Ƒxׅمەʾʩ๤Ɓࡃٔր੐̟ඊԡШӱƏҫ঎ʶ࿐ѹఴఔ۝੸व٪ʏܖ̦˅˸੭Ɣԗͯ൹ёշஅୡՙोثܯȿgɻءÒ༽ɹಓęօˇͧƫ૱࡛઱ƛࢁڹηȟԋ࣯Fೕ͓סύवʗ঩ڝ܅࠯ũطƔҫƽࡓȏЧחҥट๕݉ڗ֯Ͻϥߛ։ӑɷӈψЊӟֲڇҬࡹՠ̹{ࡅٰձę'],
                    'encodeOffsets': [[
                            -59008,
                            -30941
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BRN',
                'properties': { 'name': 'Brunei' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ͬ̾܎ҢЯ·՛Бǭ˹ϥѦ'],
                    'encodeOffsets': [[
                            116945,
                            4635
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BTN',
                'properties': { 'name': 'Bhutan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@΂ˍÏԩۇ{ۿÈՇſޅ͊kǚ֌زҒɈ׸șѺqπɥ'],
                    'encodeOffsets': [[
                            93898,
                            28439
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'BWA',
                'properties': { 'name': 'Botswana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǜƭ˄ӡॎइήĝD̑ʚՑٰŹ՚ϝ஑أݭع˩֓ʧ́ҙãƧГďʽ՝țہ¤БɾΟĸХșȵГЉʧпϑ׻đȇ̐üԠӽߚɧŲAរࠤ|Ჾشಖ͎̎΍՜ͤʮDӂȎưÙ͔ڣ'],
                    'encodeOffsets': [[
                            26265,
                            -18980
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CAF',
                'properties': { 'name': 'Central African Republic' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ۜÚƺɎƔgȾȏ੔͐Τ͠Ѭ̌ĉ̐ʂüߺ½߆ϴ؊ࣺю;ՐƜĪΫӜԿF΃ƋΓÄʻ̆ʍٖοҢͻT˗֠ѫΖεɆԋغͩƊˉˣęաpكĘ̹ïųȱ˕}ͧǲधнϥĎŗÝʥԕطǐؙĊ՗̴ۓ˸҉˓͛яùדգ²֩ƘԅѻѯޱėʐϦϧ˔̳Ѡï̠ЇѮæʢċΞÞٴȬƴц࡜'],
                    'encodeOffsets': [[
                            15647,
                            7601
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CAN',
                'properties': { 'name': 'Canada' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@؎œުxЯ΅̵Å੥Φȿˬ͆ʸ̎С'],
                        ['@@Хcઝ˂ޯІ̄î૆Ɂ࡮Η|Ʒ'],
                        ['@@хŝൡϢʥ̘ݩ̌Ưʈࡻư͕ҜðȚࢨǿԨŵ߄ė˺̃дЋ࠼΍Όҩ'],
                        ['@@։ܿո˴֠ǵ̏̉ݚɱϰȴ࠼ʵʹ؛טƞņѿʼԷΝ݉ϝփǂǾیɻńইܯԅצЂ߫Ȳࣙ¹࿅~ŹʠԼ̐λɬ۸Ԓࢄ೾Զӎܲ̂϶ǋɫ҅Չ'],
                        ['@@@@@@@@߰äʥ॓ܶگͯDԑϪ̵ϮчʾƻτºˎЂŋ'],
                        ['@@͡ѳχîəʢ Î͖ʦΆkɈǣ'],
                        ['@@ঝҧץnǿɪزϲ଼SiǍ'],
                        ['@@ƼυјżӨɗं˽४ʽöЍؤÞ׶˥ݙ˃ಳȬҽϚ࠭ҁ஡ѣ˿Ӯଗăܴдņڌ˺ޔ؈å'],
                        ['@@ष¥ȿЪΦҼޖŜپɷXέħřձʛ'],
                        ['@@Է̍ଉʬۃğଫϘ݊ʼטζࢼʃԎƯʦǅԠ͍'],
                        ['@@G࡭૰ڄ৐եʡح߾֥࢚؈ؖܨ°ईஞÝఔūૼй¼зس҃פ҇ŃУ࿩חୡŻࢃʨʣуߵ۽ʓοই֩ளÇڏΡÇձ঍Ŀਉڻ࣭ु͙ڏ±উంƕϜ޻ϼّ୲ǔ༞εࡀ͋׺Ѕ੆ɳࢸΟ൶µࣴąƍܫʼࡋ،ळనߗ٨˚ҔࡺѭೢףѶഎЀ॒לҮהç֭֘܌৷لলࢤνݾ˫ಾגȘ෸ɫࡸć۠ɚ޴˵ਚӣʮ͙ຄÛ}۷˪ਜ਼ގſ،ӵ௖Ұߦऔ֌ϸٺݣબੳघ৙͵Յ૤Ӂݰӓംɏբˍͬ܃ټŏͶͅÖऻ؍́׽̏൯̗੏ۑ෇ƋᅛǮుPࢇÍ۱׽ੳω௉૗ॵޡ܌Ɛഘૄᄈ۪సČݔЫߍ֟ˊࣟ˜هતп൸ŨࡆीÎ؍ժ̥ਣսᇷԁ࠯ͽय؁ٓÖ܆ฤ۞഍णĹջӆBନύʐ֛ƛ˧ɚٙىʱٹ̕ϡΥŽˏ¥čȹ໽A౥MϛƷࢵ؃Ŀßˍ͝ޗBࠛGϛƅƊǑøʯeďષлࡽſউ҅Ɂ@˷ƂĥŦnĔȂ̎ЂҦʘӺǙܴǵނ࢕ЂľƬūĺɳ@ǛƆ¥ȤǍēɥ¾ĊȡĊćɚٵːڹ˪ࠑ͘߁̨ݧʃ˝Sਕɔڻŉࠁʺ࡫Ɔו¾ʻƜƫҤ˳IE͓჏BᮝA᭯@ᡃ@ᠿ@៙@ᢡ@ࠛ@᠁@ᛷ@őF྽ࠜ׵δຽΐҳݖŤԨ੻ΨƧڴ৭؎iѠҲКwՌෙ՘࡭ॠՁ׾ޑϚ֣ΈѿѢࡇ˕ࠇҹݛւדπࠋɸࠟ|JⷎNᷲ༬ȭ೘Й࢘û݆ΖৰˀఢĹ఼τ൘Ⱦ־ΑظȠȊЄ׈ęෆݫ૦֬ŖّਔƐ͆ʖৰ·౼Λዸ̭ୄƛࠖÄଊэ஁зຶǷᗘĲܒƦࣆԋࣴьࡩΦժ˼৾ڦĎڴȩࡊҗरä๢ϛಬƄ௬oĭԺݞƦದ˵KߑՖڠڰuϞࡊ࣑԰কͺäघশ؎ૌƇࡘχଞॅݗЭ༠ǝ'],
                        ['@@нϿሎʬୠщॊіސ˟یࠛфΒ׭ࡰ݊Ŭ࠲Ƈश͹ՆࠉʼץථеະЉĝσൡã՚͓˱ູ̯Ƃฃɪঋ»ཅ˷ᒃű๻āҕІଫɮݙģਛږ֔ĚಘƜஈરƦྷȞᅗã஗jѷ̴ዎͲಗ[ืɚ۶ـגͮᖬԠ࡬ǋ'],
                        ['@@݉ևಹך˸Ş૸ٔȁ'],
                        ['@@öɵࢿ|ࣟjࣿőʑ¼ऍѾ̠ИÈነěชң'],
                        ['@@ڎԽޤڴᒆΈ෺ࢅůջဒʒߒͮሀыୄЏŊν༚Ȑ࢘՗᎐ܸͩ͹ߐ޻໯ϹጘչೲȁீޙೖÇʽכ้ঋਗά೓߲ઙĿŁӕࢪӥଜϯΌɟմࠩ́׿੕ɪᑏڨஎܣ࢔ԕƎ̉ᗱͲᅩӤ৳Ц̌ʂయќ௥Т`ʑᝡƅ܃˾ֆؤ཈dႸņ˫̜̊оચࠊɳϊ͕˾౿Рၳ˺՞ɆࢷԺ݋´ڏ˸҇ʛ຿ŅᵝȈᄫʚഹŴۥ̐࢞Ϧ஝Hˉ࡚٦ݨࡺ΄ᓪɢأի'],
                        ['@@৊ǯຄńɖʑ޷Е౜αƱݳ൝͗߳ê׉͎ᐡٮjˎ႖ĽएռসР'],
                        ['@@࣓عय़Խ݆`кѮΨ࠰ɮცྈȱళݟ৉Ǎ'],
                        ['@@ᕍЙѷςኹѺήΤ׌ؘܰւࠑԦᭊƀ஬ǧᒰ±ࠄʑࣖΝ੍ɃᏝןਫי@ν'],
                        ['@@ҙ͙௝Øৱɖ҂Ϛீɨܼ̬̍ˇ'],
                        ['@@ٞϵљϣس൱đࣗƈjӬ൝ÝÁٮࣜౌ˺ஂµÜŎ'],
                        ['@@̙͢ݠƘࢢƪЩԝЋ᭗Žᑯη౩mŅ˜პϊ④ĳ୯Ʈପࠐ߈ɾᛄ˳๶ӻฺÛறߨޔ̪ࢄĭ˲Џ'],
                        ['@@ढ˓ကFܨˡȑ́८ȍՔȧଊ௬ë೸ǼႊðീÏ࣒ͅȊ΍ԽɟభǷ੽ĸᜱŻႫcഫļᖁ˔̃ҦĹжࡇξ჋ĺঅʼ͂ΈႾÁ'],
                        ['@@ŗ٣٩̇޹£༝Ϋ഍ŹଗǼ@@ුؼႮծಆ[ସŬ'],
                        ['@@ϣy༽Âɡɼၜ]מƻĵĩ'],
                        ['@@༩ʋఝ˔ڼˎ௮Đஈſ˩ʥ'],
                        ['@@৽ǏඉBbŤࡴʦҌદǝ'],
                        ['@@కǥۃȚέ͂áΎજӪÅ৐̇ɫ̣'],
                        ['@@͜Ε൏Ĥ൩˘ሏߺʠ৫ȮÕ͐࿶ŕᗢ̫ٞЍ'],
                        ['@@০˕ଽʟ༇ك๥Óდņࣗ΄^̦ڔɢ໡Oए˨ՑϠ׌ώ׊ʲࡴÎοȖዜ¨੶҅මǵ൞ǃڒև'],
                        ['@@ᖢßᅮŅ໤ɫɡᏅη᎙ǟݻȉᆬJጡԙേʃ෯ۇႿƓՙǡᡷěୈĿׇƭ۞бߙ˽ಛʃЋ͡୫ʣŞȏ෬lȳᖟԋᔧɴឿŻధĸཟªĿЖ༊Ȑб؆ԢÐᖤγ଩բഹǈڼ͘๰Ȩʄ̊஋͠ΥѠᘞڒĝ಼̪ቃĬ᰽Á๣˸۩ͼগʘȁ˺దǈঘ࿲ƌం̺ਬ©ࣤɽٔҒૐƈບĢᢲҀĝ᝚ƚᆔÁᆒÁ']
                    ],
                    'encodeOffsets': [
                        [[
                                -65192,
                                47668
                            ]],
                        [[
                                -63289,
                                50284
                            ]],
                        [[
                                -126474,
                                49675
                            ]],
                        [[
                                -57481,
                                51904
                            ]],
                        [[
                                -135895,
                                55337
                            ]],
                        [[
                                -81168,
                                63651
                            ]],
                        [[
                                -83863,
                                64216
                            ]],
                        [[
                                -87205,
                                67234
                            ]],
                        [[
                                -77686,
                                68761
                            ]],
                        [[
                                -97943,
                                70767
                            ]],
                        [[
                                -92720,
                                71166
                            ]],
                        [[
                                -116907,
                                74877
                            ]],
                        [[
                                -107008,
                                75183
                            ]],
                        [[
                                -78172,
                                74858
                            ]],
                        [[
                                -88639,
                                74914
                            ]],
                        [[
                                -102764,
                                75617
                            ]],
                        [[
                                -95433,
                                74519
                            ]],
                        [[
                                -123351,
                                73097
                            ]],
                        [[
                                -95859,
                                76780
                            ]],
                        [[
                                -100864,
                                78562
                            ]],
                        [[
                                -110808,
                                78031
                            ]],
                        [[
                                -96956,
                                78949
                            ]],
                        [[
                                -118987,
                                79509
                            ]],
                        [[
                                -96092,
                                79381
                            ]],
                        [[
                                -112831,
                                79562
                            ]],
                        [[
                                -112295,
                                80489
                            ]],
                        [[
                                -98130,
                                79931
                            ]],
                        [[
                                -102461,
                                80205
                            ]],
                        [[
                                -89108,
                                81572
                            ]],
                        [[
                                -70144,
                                85101
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'CHE',
                'properties': { 'name': 'Switzerland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƫŹȳϞƵіwá΅χƙةŀǻ͹ЏơƄһ˵Л¡αǶ˽ςБſ^ϠؚҾɈϤûɲƞ܎MǦǼ࣒ʱ'],
                    'encodeOffsets': [[
                            9825,
                            48666
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CHL',
                'properties': { 'name': 'Chile' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Bም࣒@Ԓw˧ͻܛʻЭӻä؏ʨ࢟ŨੑҸ࡫Ҏୃशۘǭ୼֗૜̟ѢϬ˘ֺޠΎװı'],
                        ['@@͢୅؆ŘĺɁ˿ࢍࣵгඓǫ˓ʦ͡ץԹջ߁̛ރĀ߿ԫࡹϮฏɔƵCޛӑࠍpۯٍշFޙʮࠏԉ̧ɣݡȟࡱƚ৿ͷǡȞॹϜ͇ˡΛ϶ǙĚ̓νǃĜӱ̫૗ѽܓĮыˇՑ٣υôࢹ̧̐֔ÄgؽΒө᎔őުſݝPЙȷݷ̣Ɖ޹Σoॅ˚१ג@@ਲ਼ӔˁՒʄӰх֒Ņ෤Φ߰ࢴٰౣʔߞݒ˸ඊत̏Ѯგ֝ɠʿ਻ՉŠ˂ல˺༒ϮָʍࠎéूΠԨപ׈എΤబȗ఼ʤۚĵਞӮਆưྺ˒ნˀሤÕ൘ǩ஄ќɌɦњЬֱŐ؅ѴΡ˅߽Ҍह']
                    ],
                    'encodeOffsets': [
                        [[
                                -70281,
                                -53899
                            ]],
                        [[
                                -69857,
                                -22010
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'CHN',
                'properties': { 'name': 'China' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        [
                            '@@ԑഓΫۏѷ܂ĩخӶࠜڦَϨʡƣԓ',
                            '@@ܩЗۏʺyܢаϠࣾɾӚoȊ͍σσșӟ'
                        ],
                        ['@@ฬˍ঺ׯͼ߃౨Cܰͨ൸ʜѳݱ͙̭˽ः֡ࠇ৵ƪܝ̑ɜܙť঳ѕwLяթӺͯһಙαƀѹܩЍ˂ֽ׭ऑҋۃա୭ʑأϽࣝɭ҂ϴǭ͞ږ֠ѹѲܷ̓ॉ׏ԫթ࠙¡ѓϻѸ֩یƏϕڔʕस׶ݚ͝լuƌѱஓɻϻҏࠇућיࣜҥͦࠝԞޓ֮٥_دՅɯȪ҃ӶʻŻۃɇڗҷ÷ؗࣧڹિޭোିޡୟۻृĩԣύ̃˘Ӈй୭сࢵŹ˻ࢱҭ·ə؎Ȧ͘ૻːЇƍࡍɔЏ΀ƄӜޏƶЙܑ̀҃ࠇīڡJ҉ȳѥūŶ॥҃x÷Ȣ}Ύ؝ʓεƸر͂ʔۤՏǎȧޜࢱƓĴাߔۮۚ{٠νȨ˭ӶӭÙࣟŲ˴ΜϿԺ׳Ν۵ȸॷ՗އسڳĿοɦѹr׷Țґɇ֋رëڌԟǭওĈोȖڿτٵǔ˯ЖҽŦࡓոکʴΑȩଢ଼טࠛՒɽऐ׾őіͭјĐۆࣙঠ൧ͼʝ٦ةϼƫʌųӎ͜ԛȔ˟ďɇިʈȔśȠߤЈ׈ǐࢸő͆՜ંĲͮ̚೜ҔŠȐãӐּɔݱฦဘͲјȈ؆ຒဠˡҲϞ¢ࡆۦĀٖ֔͢èɚו۸ѽப̿׆ڱ͕ঙ̢ηূƝଆŝ৪ԻԲġϤޟӲӿऒnჄȉ૤Ŝࠦůఔԛ৮BόʽঐҌബ̈ాঘ̒׾҈ך˰Ƌˤˍ͔ѴըӀùࡺǝ࠸Ѿ౲͚؞֊נʆ௠ŐڐĥĠ̘ݿזګː٥̳ࠣžӇŃɏΆר࠾Цو৚̓ஆՎQτݸࢾҲːWҪңȦۜмਰƲ૜vసʡ݈̱԰ࡏ̀α̊ԩ̶ࠕ']
                    ],
                    'encodeOffsets': [
                        [
                            [
                                124701,
                                24980
                            ],
                            [
                                112988,
                                19127
                            ]
                        ],
                        [[
                                130722,
                                50955
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'CIV',
                'properties': { 'name': 'Ivory Coast' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ϣUוǒ՟Wহƥ׍ʍ̯ࠫǋvÞۖĄŀ}ͨΣΚˉÈʕɲǾώčО ʔƄB¸ξÝǌĄŜ̸ĶȹڨȗΎæ˸ǘÞŊúɸųٮOƸʖƢgʎĦžΫȞłΌŰϚǽƦ˥Ϙǯ̎ɄϾֺɏɠ஡Ο۷ɕेθܣͧ'],
                    'encodeOffsets': [[
                            -2924,
                            5115
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CMR',
                'properties': { 'name': 'Cameroon' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ľ°ӻŇԝŒЋÅ൅nŬڒ͟֊ϧƚǟϖɋŦXɶɎתЎ߸ʒRԄӮ͈bҾΉ־˲ĀΔȌͺžь҆ΊǞךǲȊŢѨɜ՚۾ٲ¬˨ĠƲͫͰˌʂ¶ͮ՟Ê֏֏ҜޅҷTʁÏϥČǻЅӸөμƛŠΏˆ׃ſɩх࡛ȫƳÝٳČΝåʡЈѭð̴̟џϨ˓ϥĘʏÓґڛȤڷɜ੗'],
                    'encodeOffsets': [[
                            13390,
                            2322
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'COD',
                'properties': { 'name': 'Democratic Republic of the Congo' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@»ঙͶŕˑ̗͓ɟ͍ѫǯϷ±ګț͍OهʍɹԃŗÝýҟɄϡÂ৥ưޝċѧǘӣӤҹҒ੕ͥĒ૿ƙɣĵʇՙȊχƫষĻࡇɨƫט͝ɲƴìٟࣟR·Ҧ̳ΨٟŠȋѰԣ˅ڧŞ˫ϢՕüϽqµʾ́rϥºԳųιtȻû®ৄ˩̸ÕԬŬԒǝ͖eՊ৳Qò̢ѕG­ƣԵɁӧűȿҫŠˣş։å͏Ѱȗ˖ʋԌȷض៛\\̍ķʑh΋œşʼɊĘμƎɎ̪ǰɚđ˼͐ҜSÄʃ̼ƩӶՄӨШɆː۔θࠆϬўքМĪˌt̰Ǝ̆«ӊŀݖǐԾʦ҈¸Ԕúה͜ѐҊ˔۔˷՘ؚ̳ĉظǏʦԖŘÞϦčनоͨǱ˖~ŴȲ̺ðلėբoˤĚԘۙϘķɤƖϲÅҶǲȦΫ݊֏'],
                    'encodeOffsets': [[
                            31574,
                            3594
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'COG',
                'properties': { 'name': 'Republic of the Congo' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̿˾ʩƗͻγۏࢸٖҪ̓֌˾ɂ֦ĺäό҆ЗݐʴЈł֒ĝڀЉӺζ঄ȽǘسçɻѢÔξ੘ڸɛڜȣÔҒѰ޲ԆѼ֪Ɨդ±·ԓʥ҇ǏԽĿݕ¬Ӊƍ̅s̯ĩˋփЛϫѝηࠅۓɅˏӧЧӵՃ̻ƪÃʄқT˻͏əĒ'],
                    'encodeOffsets': [[
                            13308,
                            -4895
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'COL',
                'properties': { 'name': 'Colombia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ΫȤЭ˨ʅƅ܉Ŝȱΰƽ_࠿Ӓŕʺ̼ÚтȢ̦иÊΞՆ͐Ѵ̳ȦǄӦȏސǸɚƃ܄ͻ҄ņТ˔ÑǂʠțӶĺŬѢـהΌĚT˦ƺ܂ӖϸՊfäǪڂéڌъ͞ȊОК̖»ɚɛǍ˱գƕɇп͗ʋʓ̷Ĺ׵ɷӭѢÇņϭȄȁâ͹ĳ̵ǫȸéȨ̉ઊĄӦŃעܡͼĚ؂­ӐĪ̔ƟƱҍȇ˯ß׻ǜ֑ʆʟȉэл̨ȃɠ̋ʰ࠹ǁĻǏӸɷˊ˥́࿕lZԿӰē͏ǙĔҿƑK؏ώ̫ƀӓoηϙᘯп҂ʣpժࡤٟϾԍị̈ƤҧɝصŀӵࢤϳɐˍІ֑Њɡā'],
                    'encodeOffsets': [[
                            -77182,
                            -155
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CRI',
                'properties': { 'name': 'Costa Rica' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@җȆǟǮĬƤȄɷȪͥǔ́ņÅʖəƮÄʑǗȩȓɸˑĊŗǞLʮŎˆʁŠȖǌŴňֆɝȖŊˊéƔǥʜÇȪǲɈҙ͖ͷЂΩ͗õLͷǪűűıƱëǟ©Ǖ'],
                    'encodeOffsets': [[
                            -84956,
                            8423
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CUB',
                'properties': { 'name': 'Cuba' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ܨÑڊW߄˹̭ͮ޺Ĩ̔ȡ܈ԳԺϛˢ\\ԆǟÕʁئٌ΅ıȟ֑Ń֡¥׃âளą֜Ҷ΁ɔէÈ̃ʐȥӎӃ޵ɦʥǬભž̋ǐ̀ɀࠗ¨׿ѧΏ[ťȳеğΫĂѺʸǼ̤ϞȈіǎَĄȰĢ'],
                    'encodeOffsets': [[
                            -84242,
                            23746
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '-99',
                'properties': { 'name': 'Northern Cyprus' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÐJŨȮ؄Yކʢ֧ΧÔƿęǇÙűj¥iĎÑ¾ǋVɫïƿ¬'],
                    'encodeOffsets': [[
                            33518,
                            35984
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CYP',
                'properties': { 'name': 'Cyprus' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ãࡱͿЩŊȟͶЎǀ«ɬðǌUÒ½jč¦ŲiǈÚĚ'],
                    'encodeOffsets': [[
                            34789,
                            35900
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CZE',
                'properties': { 'name': 'Czech Republic' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ϯǂЁ©ٵʲ̏Ùҿ΅ر˔ӃΰѕȬėΠƧʠؒǾ̸Ⱦ׾ǎɂǆɜīϒĖЊ˓ؼñ¿ɳҘǧŲɒּĥĄʿز»ϮЯʡCŽƯȕÅȑǇ¡wý˹ēϋbšȁ'],
                    'encodeOffsets': [[
                            17368,
                            49764
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DEU',
                'properties': { 'name': 'Germany' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@d͗ࡔțS̗ࡢǂҾɰॊͧІˋȞёɹɣ̨̙Ⱥ҅ß́Έ՛ϑĕɛĬɁǅ׽Ǎ̷ȽؑǽƨʟĘΟіȫӄί̑ϯ̟ŃŢշýƛʿǤЕ~׷ƭݍţɛыɺʩ±࣑ʲǥǻ܍Nń״ьֺ௅ƸЇɘ´ςǗȐĨ֨ƗࢢԎ@Ɉ͂Ⱦޔƿ˴ǐǲ۰°Ƽȃ֮вȓ̀ӈٌōՠŸ'],
                    'encodeOffsets': [[
                            10161,
                            56303
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DJI',
                'properties': { 'name': 'Djibouti' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȤʹΑӏȩήɯ̱҇ȅƬȭÏҷb_ʮßɶ˴Ѐ̐ϊήñʪȴ'],
                    'encodeOffsets': [[
                            44116,
                            13005
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DNK',
                'properties': { 'name': 'Denmark' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ԋڹ࢟ӄŝΒ௼˨ˎу'],
                        ['@@ȵ̓ʡĞ؁؁ɮХ՟ŷًŎͽҲ}࡬Ɣɪʌʦ݌À̐ɴڮʂѝʟ˙ĶɽҘŵ']
                    ],
                    'encodeOffsets': [
                        [[
                                12995,
                                56945
                            ]],
                        [[
                                11175,
                                57814
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'DOM',
                'properties': { 'name': 'Dominican Republic' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ŀƞپIӾɏɜtƴ̕ҠhʡϐЮ̷̯ͿЍǼϫˡ¢ƱƵ͑½ŷȲˣťͳֻɏƆ§ʎjɬɍʦȲƚÞ͒óҜ'],
                    'encodeOffsets': [[
                            -73433,
                            20188
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'DZA',
                'properties': { 'name': 'Algeria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ᮩཽᝩ࿷இϑटćU՘ϵƌԹʊȧЀᬻᆴᬻᆴṕᎠfǌ@ÊQ঺ബب࠼Ÿێɦ͎тচͪجӢòϞ̶સƚƸ͜ɛǲ̃ࢲ¹Ԟ́ՠ߰ҠࣦƢՌΎ߶ʰ෎Ƭർæшůߊͨ࣌P΀ȝֺ¾ǟћƄߟȡۙԭҵôمۊԃRȯԮ͹Ϊຝ˖ݏ°ϵƧۇÔϥŃҟòՇͫΗӺؓέ̘ҵϼƸڒϷςՃ'],
                    'encodeOffsets': [[
                            12288,
                            24035
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ECU',
                'properties': { 'name': 'Ecuador' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@҂غǻξ͍ϵԉςǞʀƙބ̎ŴƺԼ͆զÍ΄ҢǸ׀Ͱࡀӑƾ`Ȳί܊śʆƆЮ˧άȣŞٓʽճࣷ࢟য়ͧԥܵǃ֣Ӆ΋ΙъͻĞ΍áw̮ʈȨıΔ'],
                    'encodeOffsets': [[
                            -82229,
                            -3486
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'EGY',
                'properties': { 'name': 'Egypt' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɽͷǹىɫѩȝƥ˩˔ϛϒ׵ஸđùΐࢯԪࡋٌವ̴ҙ˒ӃݮछǗƣճ঒ݭƨǣΏ@Ὁ@⁩@@ᶶ@Ჴʥڲɐ԰Żά̤Ж૦b߲ɝ࠲ʛϴſ٨ˊΌʊݎêװŃɮеȜ˜ڨȣټ³аɄւ෽'],
                    'encodeOffsets': [[
                            35761,
                            30210
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ERI',
                'properties': { 'name': 'Eritrea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˻˖ΉӰϋ˒ɏܷ̄ͶֻXȭǬӯȡԛϢʽط঑ǬęʹβఀĊ֒ˆʴؤƐьӒӦঃɴޗҢУବߏҲӍҖӝˀ˿аʧʩȳέò'],
                    'encodeOffsets': [[
                            43368,
                            12844
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ESP',
                'properties': { 'name': 'Spain' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@¦״΃θஒ؆ਊƱ૾NࣂƝۦªമͰ͛໺ϡ̨ǺीϝআŊ®ӥߓ֓ઁǯõ˱ԩү͕ہ͞ӑӟϑǹճىǗש٥੧_ߟhՃ͍̓ͅЩê̵˴ʃӚ޷žé˦̶̀Śɬ̃ʢɶրͳԌδèЈƎŬZپϲɪɻфөƝŁӹCɁЬ΃ū̥ɇ'],
                    'encodeOffsets': [[
                            -9251,
                            42886
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'EST',
                'properties': { 'name': 'Estonia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĮӸ̱ŁՓ̘ñӘਫ਼ɼ੔Ũ࣮Ƒࢂ|Ŵƣׯӝʞ޵ΫˉۙDܡ̸ρļ܏Ʃ'],
                    'encodeOffsets': [[
                            24897,
                            59181
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ETH',
                'properties': { 'name': 'Ethiopia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ԜϡӰȢȮǫּWܸ͵ɐ̃όˑΊӯ˼˕̏ω˳Ͽàɵ`ʭҸaȮÐȆƫǽ̴̕ҧ̴Й̛͎ᩨঽۺNᛛᡃફݟףաeɯ˅ַB͹˴ލΙʝΓ֕àȃĬȟwˇT੟܌ב@˹ˢ@ҾѧƘӻࣴϥȚƧʹэЦԧÒ˸ӐҀrŲʰ[ݲʞࢠЊɾĎ΄ήٜԔи΀ࠠƆܠ঒ǫʾظ'],
                    'encodeOffsets': [[
                            38816,
                            15319
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'FIN',
                'properties': { 'name': 'Finland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ūיಀ֓ޡى঎ख़֡ܛݴس΅յఘֻ́ѓޭӟᅡੵໃá๑̯ൃǯӡҞ߿ˠȈࠢСݶАӪނՆ኎࣮֖Ǭē΢ୟЈ˳͜uಒ಻ֲ૩ЪԊɞतѻલ¦ࣘȭߠϊЬ؞ಬ˶઄ͯΡכ'],
                    'encodeOffsets': [[
                            29279,
                            70723
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'FJI',
                'properties': { 'name': 'Fiji' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@̂ʍƓѭԳŗҩļąτ͖̀ϤĻȼƐ'],
                        ['@@՛ǯŅ̼оǤˊ°Ӱˀ@ЧՕȷ'],
                        ['@@é­@ШǨĽЗ']
                    ],
                    'encodeOffsets': [
                        [[
                                182655,
                                -17756
                            ]],
                        [[
                                183669,
                                -17204
                            ]],
                        [[
                                -184235,
                                -16897
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'FLK',
                'properties': { 'name': 'Falkland Islands' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@৘Ԍ܎ȿԌʹڦϙʥ̋ଋʥϙ̌܋ϙпϚ'],
                    'encodeOffsets': [[
                            -62668,
                            -53094
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'FRA',
                'properties': { 'name': 'France' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ˣ٭ϡǠș֢ǜ̺ը͎Ɯܛ'],
                        ['@@הЅќà݀ϥȊñʎjЈɗெƷыֹŃ׳ɱƝϣüɇؙҽ]ϟВƀ˾ρʁʚ̿̅ʯɐٱҖŃĩηݿӅစɬ௧˗ĩԑঅŉिϞ̧ǹ໹Ϣͯ͜ѢԎǆူࢁࢤإю౹͒čؖઠǾථɏˇॎߌέዠپʨێܾǞŪ̑ϸ_ϸ͵']
                    ],
                    'encodeOffsets': [
                        [[
                                9790,
                                43165
                            ]],
                        [[
                                3675,
                                51589
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'GAB',
                'properties': { 'name': 'Gabon' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࡹࡔ։ۚԙࢄ˨ǾˎȲؔǜخ˴¶௢SOৠЌÆԞőӼňľ¯ÓνɼѡشèȾǗεঃЊӹĞٿŁ֑ʳЇݏ҅Иãϋ֥Ĺ˽Ɂ̈́֋ٕҩ'],
                    'encodeOffsets': [[
                            11361,
                            -4074
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GBR',
                'properties': { 'name': 'United Kingdom' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@҉ֽًǦԱ[ǦҊǥ҈۴ࣔԳ'],
                        ['@@࣋ࣧࡦŘऄIɕۅݯݩࢄÃäĕݠ঱ֺƇԬढ़ʈͧৰǅķ՝ѓʗͲѣݱѯ૳Rෝɱϻǒ։ϿޥĪם͍ҁǘ௼ࢨݪǺOBಽƔʃͰ࢜ʺҡҐǆռఢ÷D@ŮӤ֛Ԯ_\\৵ƨȧɬ̨ϒˡɴҍЇ·߶щє̨ࢆٶھڤá০ì']
                    ],
                    'encodeOffsets': [
                        [[
                                -5797,
                                55864
                            ]],
                        [[
                                -3077,
                                60043
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'GEO',
                'properties': { 'name': 'Georgia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ųάȿִӟ̲ҭĬ̯ʴĺĲ܄ƝఆƋଦЕƦƻԚƂ޶ǭʴ·Նșɓřвғŗıҏºصʎȵƍଢ଼ſ߳Юࣅ¡'],
                    'encodeOffsets': [[
                            42552,
                            42533
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GHA',
                'properties': { 'name': 'Ghana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@೉ӯҳ˽ݳʑݡʆͨηܤɖैΠ۸ɟ஢ŗنrӊฤ¢ϊÕ˔ƊϴáÕʿΖџC؍Ąڍɂ̫ȅݳäйɢՓȈ̍'],
                    'encodeOffsets': [[
                            1086,
                            6072
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GIN',
                'properties': { 'name': 'Guinea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ʃtǡͷʁJǏǴÈͶΗԨɕħǵmɳ³V̮ƇɘʔǻΜɹ̜ڥDțǁɵoƝǷīɹ҅σρӼ͛͢ɋŊȿǖħϊūȂʓƐώЦʮeɖƘȄDƄŎï˨ĢĖd˶МU؀ȱȄlÚĤҜáŨ´¶̭ƆBɖŒƔɸɇάãɲǺ˖ŒȬŠǚuȈȁĴɳΆΙǣɏ˙ǴĊŀį«ʡʲʍǗÝå˷Ș΍Ⱥڧ̷ĵăśÞǋ·νƃA'],
                    'encodeOffsets': [[
                            -8641,
                            7871
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GMB',
                'properties': { 'name': 'Gambia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ņόࣶzȎȦˊ`ͨȷʼIˢƚǞʏεȋιdέǰ̷ȗƭQȫŝއl'],
                    'encodeOffsets': [[
                            -17245,
                            13468
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GNB',
                'properties': { 'name': 'Guinea Bissau' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@҅ΘΝÈȕʀLŸʯǴÁǶѼƌ˦ɦĨ༈c˵ġĕð˧ƃōȃCɕƗʭfύХ'],
                    'encodeOffsets': [[
                            -15493,
                            11306
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GNQ',
                'properties': { 'name': 'Equatorial Guinea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƿŴ़̀െmPয়௡T˳µ'],
                    'encodeOffsets': [[
                            9721,
                            1035
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GRC',
                'properties': { 'name': 'Greece' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Ҡ˱ٺ¶شÑqƣҜĶĿʛ௃íTƒਁǎƺΦ'],
                        ['@@ʹՁȥĥԟ|ѫĀৱɓ׌ҿяƋҳAѻўƿȁȊԅрЁ̓ǿҴϯжʑ^ӅޥɠʜѕՓĕ͈ݏ֏Yۍμ̿ڦƧ֒͝ϮљӐÉʆϸТ¼˚˘Ũjɚռö͌ȀҖgƒƦǆت{ڨɲע̉ކĀVмЦɝ']
                    ],
                    'encodeOffsets': [
                        [[
                                24269,
                                36562
                            ]],
                        [[
                                27243,
                                42560
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'GRL',
                'properties': { 'name': 'Greenland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ᬜԆ᱒ੴ̴ᲈĄ䀦Ŀ㉊ڗ༅͕ộ⭏ćшƫᲐĠᡚ́࿈ʴۦ̝इӧᒞ̺✘͚ᠼǋҾΫ⃝ױӃȕ᧑ơወ¡ছؕگկध৚շಽ൧ˇ༂ѽȢ܋࣍ýઞܡህÑঈ΁˟̑இŽ୥E੆֩\\Ϗပΐћɣଌȿ઼ԣ͈ڱກǉ٫͖ਣӘ˼֭উѵᕖ୆¯ᖯܵᗿڏឧ́ओIࢅ͓ୟࢱᅵכׅ૧ȷ஽ȝܛԱ[כыտോڧͺٿϗ۝љࠍஅ½఍ۈဿLࠁҢ֕ࠐฝਲэոŗݮ୓ޢ̢ئ֗̒ࠪচొ̺ͨΘǬڀॡ̕қůݯţਏ˜Éְ͢҂ެ\\႔ɟ෿Քݩ˾࠷ş۫ȼम޴ԝ̺ڗ׈ৡࢼ੯͚XΚᖷӮᄻÖᖟᏅ×ইˌวՈᕂ˄ၚ¬≹ɖ቉΄Ś͜ẊИᶎИ̪͘ᗗ̠ܺͰ᯲ז௢ĚΓϘጲɜᣚƂᣖRࣺʽᕺҨፘ̽୺áპ˙ፅҐŘή'],
                    'encodeOffsets': [[
                            -47886,
                            84612
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GTM',
                'properties': { 'name': 'Guatemala' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ћƦԻfϩǖҍΌrʖĮȠšƾКۆ઄Ft˸Ƌ¾ġǺ̵Ț̹ˬϜDBӂ޸BަUOڗßॅʤ@˚ƱòŰʘŃϥ͍ЉɻÏǉâǑǧɇȟ½¬ıƿġ˽Ƀ}ŭ'],
                    'encodeOffsets': [[
                            -92257,
                            14065
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GUF',
                'properties': { 'name': 'French Guiana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@͉͑ГÑŗʀȉʹɩνǦɈΪòϤƢή͛ӸáֺѪܠ˸ğؤȥࢸۿƔ·ӻޑʳأ'],
                    'encodeOffsets': [[
                            -53817,
                            2565
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'GUY',
                'properties': { 'name': 'Guyana' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ր̯Դյzџ̈́o҈Чͪ̇Ƈݱԛɕ°ȣƹџϊ؏ːAŎӃԢܳȱҫî˙ɡϟƥ˅ġǑЭ¦ԫЀÓϴɋьƆܐɸ̐ȕϸ˿ŶŊτțȘѩْ֩ɬɲiϲԬƊȾƾ˽̸ô̬ږӲ'],
                    'encodeOffsets': [[
                            -61192,
                            8568
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HND',
                'properties': { 'name': 'Honduras' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ơˀʭòÐʹŗĞǣÒσĳŔʩƈǷǚʛìǨɈáǒÐǊЊɼϦ͎ĔȂƨʊ\\þåž¦ϸùϲv˒ĢİĦˎ©ȪÉɘnǖòϨśƄkʲƿʐį̏Źɜɳ˽jśŕ̇ŋɃAȅŃǙƛźĕ{ŇȩăRaǥ̉ɳƹıđĽʛǞǹɣǫPȟqlЭūQĿȓʽ'],
                    'encodeOffsets': [[
                            -89412,
                            13297
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HRV',
                'properties': { 'name': 'Croatia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ȳ͗ˊʇ͓̓ϝȆׇ[ܟƔϽmǻǧ̝ȖǫΑЪϽǼʹϮ̽͌ȃ͆Ηݔ͇ġƛ߃̶ӣ̢ޑʠ۹ؤǞØϥΞe˲եƄʱγʝˮn̆bגƸƚ˸ƍͤgGɼ̈ĒĈͺڞɠˊĻؼέۜǉ̼Ų'],
                    'encodeOffsets': [[
                            19282,
                            47011
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HTI',
                'properties': { 'name': 'Haiti' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ԢܰƁôқÝ͑ȱƙɎʥiɫ֏ƜЅÍԡÔϽƿ҉ʾö˔ޜśيã̢ȈϧθP͎ՋžȌɶ'],
                    'encodeOffsets': [[
                            -74946,
                            20394
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'HUN',
                'properties': { 'name': 'Hungary' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˨ըǍǼӂDÜ΄ђɋ̲ğ۸ļäǚͮ~ЦžĜÃЂŀȠȢˠ¼࣒ʭǴĒҲɭÎɣԡǭЉ֫ԕ֭کǁԽ١ə̻űۛǊػήˉļǍ˴ƗV'],
                    'encodeOffsets': [[
                            16592,
                            47977
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IDN',
                'properties': { 'name': 'Indonesia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Λe૝ך޴ǒѴʭ̎ʭ»ɩ'],
                        ['@@ܙȁĳĶø˸ΰԢࠨͬĐǓfʫշع'],
                        ['@@̢ɣԲèȼΥॿǛ׉őҍP̀ӚҤPɤ̖'],
                        ['@@ūұ౅ʅૣľE̬ښǪՂʥ֔Üݬ̮'],
                        ['@@ྔċȂΌ༘З̪կీƵਐӿय़͋ऍ͸ݻwࢍØ޻ưঅ͎؝ČΓŁ໕ΌƣΰޑØּߤ৶·ڴ͡ΒÛŘ̗'],
                        ['@@ѝֱćنƬ̠Ǭ˴ȒʗCЏ'],
                        ['@@̿˥ׅƸǏΰࡘ¢Ⱦˣ'],
                        ['@@̨ٝۿΌۯìӃÅׇȦҦਠऎʕ'],
                        ['@@ɼയ࢈ԉ۰ࢼ८ԔݜBܘ̉خ̛ࣘǇbᩑbᩑݟې࡟ǜȷʇ੡}ΦۂՈɺɕࣲЕ۸࿃܆ۗêృަʛУ͑óȏ̮GκٛЮ̢ࣞ״gëɠ௵DͩԄݥƺΡдଈȰњ˜ഘ·Ƃ̹'],
                        ['@@ڭ࠭كǉ߱ǐඓ¥ܽŧţٍݪݛҒϠ༪˸çϯλŪιӯ͙݉ߒ੿Ƶ˿ݲॻQտ҅ʙ̐͡Мی࠙͗ȻɶŊ͖؅ӲØࠌ֕ʭîওறՓũίʚʌޜŽ߸ΛPʻֺΎվŤښф౎ǮΎ܎ذپʛ੖śॴࠨ؎Ʀȉ'],
                        ['@@©ܽџĈŷԝΌѷɽĵ͹Ւʟ੺ǚڤ˨̨ÔҝӸóĀ΃'],
                        ['@@सާহį˫ֵݿַ߱u࠷͕౻ŭ̚ॕϙͫԤ׳´лːৃ̟̩Оս¯ۗĬŹૺнɺЕܘŝ݀ĮުԂ֐Ɩָ֗ӅըǠ՜ÑӪъЖôߒɽۆǶњୠ͔̈̆क़ॲ@ܰƙӍݷآߓơϭ'],
                        ['@@छkۻ۰અۊέԚٍۄзؾٕ୴۪݅ʙܠ̳ڀݵՊѭܘمҺࢗऒóђզಢǋݔࠓٮ֫ҪΓߔࣙࡢ_ۺֹӠ۳٘ϥͳۉӖ̞̅sƜו̊ҵؠõФՏɁ਱ಟ']
                    ],
                    'encodeOffsets': [
                        [[
                                123613,
                                -10485
                            ]],
                        [[
                                127423,
                                -10383
                            ]],
                        [[
                                120730,
                                -8289
                            ]],
                        [[
                                125854,
                                -8288
                            ]],
                        [[
                                111231,
                                -6940
                            ]],
                        [[
                                137959,
                                -6363
                            ]],
                        [[
                                130304,
                                -3542
                            ]],
                        [[
                                133603,
                                -3168
                            ]],
                        [[
                                137363,
                                -1179
                            ]],
                        [[
                                128247,
                                1454
                            ]],
                        [[
                                131777,
                                1160
                            ]],
                        [[
                                120705,
                                1872
                            ]],
                        [[
                                108358,
                                -5992
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'IND',
                'properties': { 'name': 'India' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࣚটďۅͮїѕ׽ŒɾएࠜՑ୞חՑϟ͛޻ࠀͅߊЭરһସŉӜёٮāৠȝ۪bĪͪŋՖÞβԠǮìڋlǙކ͉Ոƀ܀Çۈ|ÐԪ΁ˎڴŀވشॸ՘۶ȷ״ΞЀԹ˳Λ࣠űÜ͇̍Ʒèԫ׷Ʋછׅ~ӓҩ۵§ХϏۗځȒࢇȏ˹ĚΣгȥѵ೰ɵEƍ՝ҡѦʸӎϖ¶ϰ܆ӝƜީ]ߝŚóאБ¤ڕζ֭̓؆ѻԿ̻ȅ̩Ԭɣƛԑ̆كžەţֱ̫Zਛǩ´ك҃ӻ௃֡ळ঩كՋ࠷ջCϭлȹݳ̝Ͻ«ʥٙǪધ®ۡΣߙI෗ѣ¡ϣٙʰˣދʃ˱֯͵ʍߑ޸ϳ୴͑ࡒ̍Јѿ߰ȻੂơՀޅ଼Α࿀ʣ੾HৰǍ޾௣ԉףĶ઱৲И̤ʝͤড܊֖֔ᇜCǗܞҽюĩ٨ջϘऒࢢঊÙ࢞ࢢՄ࡞ࠄࡈ_״ܒӠڳд֪݂̇̕Ьβ౤ȱपŰߺ۸'],
                    'encodeOffsets': [[
                            79706,
                            36346
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IRL',
                'properties': { 'name': 'Ireland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƒ׷ًݣ๯ӹ஑Ŷڼ࢚ѭࡢତڄٌϼǦ҇ǥ҉Բ\\ٌǥ'],
                    'encodeOffsets': [[
                            -6346,
                            55161
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IRN',
                'properties': { 'name': 'Iran' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@݈ǌװӔ֚{τƾװýघэڤğ।ݓظòۻ΁਷ɱؑκŭΫҡˠڡàՓِƙæեݿݿжѵ͸ԓߦυx݉ДƋêϯ௉ѡ̓উཌྷʪࣷȖेŊΧਐЕƪ٣ƭࡑНਇ˦ࡑ٦߳ʈ֗ߘا૪ҍƋՕ˦̻͝ҭѴS҂ˍ@Ɛ،ѝٔ਍Ң׉ߜȜپц̂ÙӬտʨխ৊ҟڨǐʼʿ६ּʈƄͅъϯ־ő̤~রئ̀Øʞʙ́гԼѱȾ¦ˈإߖǩ׎у஠ƟಾɞĄȞ'],
                    'encodeOffsets': [[
                            55216,
                            38092
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'IRQ',
                'properties': { 'name': 'Iraq' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@րʧÚӫх́țٽ׊ߛ਎ҡўٓƏ؋ˎ@TҁҮѳӿ¤֟ê؝߭༟äᛍၖఫךৡɪ͹৾ᇶ࢔͆৬āؘҢȺјԾΰž঎Ň̐ɉЖƚծ৉'],
                    'encodeOffsets': [[
                            46511,
                            36842
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ISL',
                'properties': { 'name': 'Iceland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@șիॊֵથٙᝓֹܣƵૉŮᚑˈࠠψᆧЪ๪ǎʘᄋȜ֨նౠŰಸ֭౨Ҝ੒ʃൌ҄ආÑ'],
                    'encodeOffsets': [[
                            -14856,
                            68051
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ISR',
                'properties': { 'name': 'Israel' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƥ˅̣Ŝǫ֓ɂĥɋřɛЄŖp͛нഉց෾ʔˢË¶ɞϼǠيŤɆzVˬCþƦɤ\\`·ŕŵhM'],
                    'encodeOffsets': [[
                            36578,
                            33495
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ITA',
                'properties': { 'name': 'Italy' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@̟ڋŲʹǭѝٝ̈́ёĞ୩ѐŞќজûࡪĠْò'],
                        ['@@Ԍ׭ş૕ϣÂ΁˫͇ɞ২ȓӒҨ¥рʼ'],
                        ['@@ரɏĝЯȬΧڝŪہ̗²зĻʇˠё߀чцۛदڱچLȲȃɽǗݪ̥ؠʩܜѫĔƿƽ̛үϼܳƐΝի؈̷ıѫΗ¹҅ܛΕÝHʲǢҊǼǶ͝ӤʱшΑŀʛδգƴεͶثÆٿϜޑմ֯ӜʿࠪйĮہˤϯŕӝϵΓÕĪθҕńɏٲ̆ʰʙ̀ʂβǵМ¢Ҽ˶ƢƃАǼͺتĿψƚâΆԘšĮǆࠨƤȊ̉']
                    ],
                    'encodeOffsets': [
                        [[
                                15893,
                                39149
                            ]],
                        [[
                                9432,
                                42200
                            ]],
                        [[
                                12674,
                                47890
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'JAM',
                'properties': { 'name': 'Jamaica' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@֢÷ҀȫƔɯןeʭƗҹƊӑ̪ĶȔΜÎȒ'],
                    'encodeOffsets': [[
                            -79431,
                            18935
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'JOR',
                'properties': { 'name': 'Jordan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ʀˆपͫ࿪ࣆͺ৽ǅų၅у࠸࠿ˣƛƑ˭ٙřȩ̡εʵधƆŨоഊo͜Ůʚ@Ԥ'],
                    'encodeOffsets': [[
                            36399,
                            33172
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'JPN',
                'properties': { 'name': 'Japan' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ņ˽ҿԕΉːљțɝӭշʈRЊҬԆӌīΊΜؠǹ'],
                        ['@@́ڡƤсѩף੹Ѓ๏½ணॡ͔֡غษȃষЃঝe࡞أ֗෗իΝН͜ȶݶՏʒͿ־ߐʶѲՈࡌѢ؞ָာʤ࣎ǣࢠ๺֔Б௾ࡀӌ͜ՈਈƟा΢ՎࣀƸҞୗ}ڻޥࡍbࢁ'],
                        ['@@נǵרΤȈहఝɯ݁࠱೓ָқँण]ř࠴д٨࣌²ʖ୐ʜټন࢓٤˯']
                    ],
                    'encodeOffsets': [
                        [[
                                137870,
                                34969
                            ]],
                        [[
                                144360,
                                38034
                            ]],
                        [[
                                147365,
                                45235
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'KAZ',
                'properties': { 'name': 'Kazakhstan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӕƹ્דο׹̹KɱЊ੫ǡێХNÚࡆ৓ؘ෷ßডũߣݶۋ͆ಥ׼ƽðᓗӹᶽљ£יچ֧ɼॕǩχ˧±ȲȶΖǅ̊অ˺ϛݮҩɆ˜ࠊāؘ܎ƎܼűƲࠎƭԲ࠿£܍ȴঃσ޵ǭяƌĐўՙ֘دw܉֬ӞِʕǢڢऊࡺӣŀؘჄࣴಾtᇢ׉঺ͻࢼΠ೰j੺ѥʔʠ୼ɂЊഷ׀߮Цƿɮ߮ɔ؅ֺϬ˼Ḯ̈ШȺᑆ̴ݰΒຢǹ˄ࢉ࢚Ȳઆ˹éҝ߮´ᑌߎ̭ˁ੶٭ሠᒑ҄ѰୄӛீɎҪƯКӟטǋΨΥ઎ŒѾԣٕ֓ۥÿ¡ࡅұϝဟˢ؅ຑїȇဗͱݲลֻɓäӏԭŬу̠ఝĖඃx̧ġ஥ΞӉǧŽӹ൩̂փşȉρ'],
                    'encodeOffsets': [[
                            72666,
                            43281
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KEN',
                'properties': { 'name': 'Kenya' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӾۙיͱȹΕ̿Õšףˑ͹Ǐ֑ͷ˥஻ࡀËӤᵁႌƙĢSࢺʊ;а֌̨ؔσ॰įтЉ׎ԬԈ֬ֆѨƗ@ҽ˺ˡג@੠܋ˈSȠxȄī֖ßʞΔގΚͺ˳ָAܽ॑Xᵣ'],
                    'encodeOffsets': [[
                            41977,
                            -878
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KGZ',
                'properties': { 'name': 'Kyrgyzstan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȊςքŠ൪́žӺӊǨ஦Ν̨Ģ඄wఞĕф̟Ԯūşȏ೛ғ̙ͭઁıͅ՛ࢷŒׇǏߣЇŜȟʇȓཟŵਡ˘࣫ÝĂӜࣴƕ̮ʸٖĉ੾؂঻ѸױȽإ͂۶ծʟĊ'],
                    'encodeOffsets': [[
                            72666,
                            43281
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KHM',
                'properties': { 'name': 'Cambodia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@΁Ѭыࢄȣ২ՠۨઘǆ߀ťۚ͡Ϟׄݖ̱Ȝ֕Ļ৕ඳ٧τԙࢥÓܫͷ۱Ū'],
                    'encodeOffsets': [[
                            105982,
                            10888
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KOR',
                'properties': { 'name': 'South Korea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ܨযȺխPॷ̓ҥݽǉڥΏݳïĥҚƼـχ࢔ذƚֻܘÂúϒ͞Ϝצ¢ΨÈŨȮ'],
                    'encodeOffsets': [[
                            131431,
                            39539
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'CS-KM',
                'properties': { 'name': 'Kosovo' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǣŃPĘ́ȩĐǳɦƾȌȪÒŜ˨ư²Ţşƾ¿ŌƅƒǎƻŢLĥȳĳĳ×ȉӹŻ'],
                    'encodeOffsets': [[
                            21261,
                            43062
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'KWT',
                'properties': { 'name': 'Kuwait' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ǭχõȓ˔هשuȽАݟĆ؞߮֠é'],
                    'encodeOffsets': [[
                            49126,
                            30696
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LAO',
                'properties': { 'name': 'Laos' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˚Ϝ܆ڹܸ¿ٕࠦھٍÎǛ̉ӯyʣƨࢯԅoݬȸࢮ֧³ԎηʸǴ̲ܐնøȡ҄wŵ०ѦŬӮڏϖޅਚO͚ܹ՝ɗʉ̟৔ԉۦ঳Ռ݋َ׏ɄץƵ࠿ݕ̲ϝ׃ۙ͢'],
                    'encodeOffsets': [[
                            107745,
                            14616
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LBN',
                'properties': { 'name': 'Lebanon' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɣ[ýƥ˫D̘ۄмעfϘ§Ɛͣқ̓ȷҟ'],
                    'encodeOffsets': [[
                            36681,
                            34077
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LBR',
                'properties': { 'name': 'Liberia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɗQࡽАޅٖ܏Ң֣ըȪː¬ʔϜҘϺϺǶnɖĨΘԧÇ͵ǐǳʂIǢ͸ʄsʓĎНǽύʖɱˊÇΤΙ~ͧăĿÝە'],
                    'encodeOffsets': [[
                            -7897,
                            4470
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LBY',
                'properties': { 'name': 'Libya' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ק̷ҿҤ೧βρՄڑϸϻƷ̗ҶήӹؔͬΘñՈńҠÓϦƨۈ¯϶˕ݐШȜðΠėΒ־͔ʶːЦʌ´٦দ́ΜðۮƓ૞ϓЀݛݮǍஆΙࣆйЦɔЖϮț٠˂Ф؄ЀׂŘ଒ǣ˺ϑ̺Iˌƛ࠴ıȲˣ̣ЕżΫɏԯʦڱ@Ჳ@ᶵ@့ॱGYΙ‧ྐ‧ྒࡓҟ'],
                    'encodeOffsets': [[
                            15208,
                            23412
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LKA',
                'properties': { 'name': 'Sri Lanka' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ų࢓ΙʇܵȓЍڜƫீϠ഼׆ұϺסО࢓'],
                    'encodeOffsets': [[
                            83751,
                            7704
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LSO',
                'properties': { 'name': 'Lesotho' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̆ʩʳУƛ˛ҳſƹˍ̛ċؿ٨҄ՐҖ͢ϼǠξʵ'],
                    'encodeOffsets': [[
                            29674,
                            -29650
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LTU',
                'properties': { 'name': 'Lithuania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ãɊĚɲχƄࢡƨǱ۸२ʴඬÁࠜĊŞǩ҂Ã߲СĀϓۏˏșӃ࣯̓߻NȫʶљĜ'],
                    'encodeOffsets': [[
                            23277,
                            55632
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LUX',
                'properties': { 'name': 'Luxembourg' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǘȏ³ρʍiȉòĞҼɖ'],
                    'encodeOffsets': [[
                            6189,
                            51332
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'LVA',
                'properties': { 'name': 'Latvia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@نЮՆߊ˼ڜعڪhǊ٤ܐƪςĻܢ̷ۚCКȕîС˒ӷ͕ࣗԛƙ߱ТҁÄŝǪࠛĉණÂ१ʳ'],
                    'encodeOffsets': [[
                            21562,
                            57376
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MAR',
                'properties': { 'name': 'Morocco' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ԒΥߜÎࢊȃκU͂՟ºԝ̄ࢱɜǱƷ͛ષƙϝ̵ӡñثঙ͍ͩсۍɥ࠻ŷഫاRহŷ@@@p҉Ա˓ȑϡ@̥Ŋ۹ě˛ٻʿÕЁ੕ୟ࣡ˣୋ΅ϗĵ̡ቅãaD ϶͒ɮ˞ѪÃ˶̀פҴՖ˲ƊɞӬp҂̤Բ̪֔Ւ࡬f\\ц͔ްĢڎָтɠۮۮȿਸ਼͊ܢŔѶդ֨ࡈϦخΐ֘࢈˄ԪؤI'],
                    'encodeOffsets': [[
                            -5318,
                            36614
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MDA',
                'properties': { 'name': 'Moldova' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ȨŮ֒ĊؤʽΊϞɥÑ˵̪ƏŨΗ̊ɇÏűƾčɝ×ӷ|ĉŜǫãÒƭɱˍƥ˽ɁĝƯϦĘΪςӝԂˉΠʹʠʯĈ'],
                    'encodeOffsets': [[
                            27259,
                            49379
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MDG',
                'properties': { 'name': 'Madagascar' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɠΥȺ։Ɗঢ়ɒϽĉЗƩʙ˷ӰǁʝǈثõΥɵȗ¿܅ͧওб୅ԯཧ͑ୟϛইہȣܻΡӛɊڙ̜ɳѺÇݘ̑ڠù؂Ʈ؄ϰƢD˪Дِø՚șЈǃՌãޠ̊ҺŔՒмҶǤ̶Ʋτ\\ӐӎۖԮʦцŗάΦĵҪ׎fԐ˦ϔ̊ί'],
                    'encodeOffsets': [[
                            50733,
                            -12769
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MEX',
                'properties': { 'name': 'Mexico' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@͙݅ƥ؁Õ૷ąЧƤқʺЧǚٳ֎سȞӏ͢бࢾɝΐΙ݄ɾٚĎؼưՊƠՖ΂ȨӬè۸Ƣʖ֬ɚࢶȚݔԚîȬǱЙҋԁȥԝƸƥűγɁٽɅɎǭcǃY̝ԓƳĲķPŭޥV޷AAӁϛC̺˫̶șĢǹƌ½s˷ઃEЙۅŢƽĭȟqʕ्ࣞџ˘ۇɖҷÓګ́чĉץɜؿǄ޹ϬؿŠ्ϸ۱ВɃɤҹº࡯ˈΓϦࣗӊсՌȧЦ˪ĈđʈȖɔJ̄˱Ϙùͮ˭ъ݋࠴ࡋڀУԼܝ΄ƷȴŸԲѓȞӹФȽהҍæӣѸϿФˀҍو̓٠^͔؇ͬ˫ӑɴƇͿƔЕĆف̀΋خׁƒȡŸÓŎ˽Ƭ\\ǜթʮɇǴ̕Նё˨ޯʠρɸϿ²ѷКͶϡ̨ϑqƭΝ̱ƫJɛԞջӎ؃РїɈؚŵҖЏʺֿϒŏŇɃɖԭȰӷӦÖÚΊ³̸̼Ϝ٩׶ӱɶ̱Հ̷վϳڦͿݲॖÞ੪ĞÿǑ౔СኀףဪPژ@DΌผ@̪̕јˇԀσ˨ѭȾҥѢʩۤʥՊڒۊhפͱфֹ̄ӯӸӏȂחɾЃپʹ׮ȁ͞|'],
                    'encodeOffsets': [[
                            -99471,
                            26491
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MKD',
                'properties': { 'name': 'Macedonia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ńOǤӺżȊ˺¶ϴbтˏÒ։ǅƑƥҕh͋ǿջõΑȴšήń˸'],
                    'encodeOffsets': [[
                            21085,
                            42860
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MLI',
                'properties': { 'name': 'Mali' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˰ƶƘӶˊpזɻӄǖ͖ÇŴȈ⁚^ȈךƣļЛ⋈Л⋆౾dᬼᆳᬼᆳȨϿԺʉ϶ƋV՗ठĈFካҟ֗íԭݛƃ଩ï̳̗ա՟Iȿǈҥš޻ΑǅʿٳϕŗɍΙǡНŔɱȳūֻڙۡp˳ɭΣÆӥ΋ůȝŁŽάʍĥơhƷʕ٭PɷŴŉùʱʎ¬ʢĿİǳĉ˚Ǥɐ΅ΚĳɴȇȂǙvȫş˕őɱǹΫäɷɈƓɕőƅAµ̮ʾí̽͘ʀǓӔԺ'],
                    'encodeOffsets': [[
                            -12462,
                            14968
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MMR',
                'properties': { 'name': 'Myanmar' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӫηץϥࣥΟƳО݅ՔؗΈօ̭ܵ̃ƹȪу֖ڙĪҷ_ϵ͠ދң޵Сࡷăذʴ٠˯ӼæࣸͽѤ˛৔Ʊਗ਼εۢօуॕ׳ҽöԳȠ̂ਪǫ޾څॺļ̢ӭņ׭ۆÅڰ̊ŵj׾дȦęΤȐ˺࢈ڂȑϐۘ¨ЦҪ۶}Ӕજ׆׸ƱçԬ̎ƸÛ͈ӮÚˮӵξȧ|ٟۙߓۭĳঽࢲƔȨޛՐǍʓۣز́ζƷ؞ʔ~΍܏յǳ̱ӓȗ'],
                    'encodeOffsets': [[
                            101933,
                            20672
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MNE',
                'properties': { 'name': 'Montenegro' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÁǀηЯÊˋǫÞɽ˞εǖĢƜŬҦ˚ȜƾüɠƟŬśˠě͌ǧçïƽȋɧó'],
                    'encodeOffsets': [[
                            20277,
                            43521
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MNG',
                'properties': { 'name': 'Mongolia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࢮƢ྄ܤ౬Єܴʳ࢚]֘Ͻ࠼ௐɁࠈגͿӶࢊࢊश΍ނįনɍǈؿஜΛߐƺਫ਼ŌࡆōࠖЗԚѕެT੒Ƌޜȼૈƒ௸פԌĝѰ˭ৌêХهק࠽ɐ΅ӈńࠤŽ٦̴ڬˏހוğ̗ڏĦ௟ŏןʅ؝։౱͙࠷ѽࡹǞҿúѳէˎ͓ƌˣי˯׽҇গ̑ఽഫ̇এҋϋʾ৭AఓԜࠥŰૣśჃȊऑmӱԀϣޠԱĢ৩ԼଅŞুƞ̡θ͖চׅڲன̀۷Ѿəז'],
                    'encodeOffsets': [[
                            89858,
                            50481
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MOZ',
                'properties': { 'name': 'Mozambique' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@لæ৞ʁɖńגt̚ʦԌaऀ͜ڞӤƊϕ࠷ľ݅ಿƨЫʣ׷͙׍՗Եޏ͉ृСॉ͓ࣕƵוׯ΋ȗí׳ЌُǔӱZʣƪ¦{ࠗƋϷȤƝűΓΗ̗ۗ˳য়ҕρ̳ðΟɊÉíѵّRïϊůϖí̠ƬपɓװГஂࢬ॔ɜ؆ŶúĨӶƉʞغǐ׌E੠ѥ˒ЏÔǹȼϳǰ۫gÅ̼āװᢈۘӚЕɴüͨɅ¸͵ǯϷØסոԱʲ׌ζǰíઊΙ؈̣˖̅]ɽદɾٔ'],
                    'encodeOffsets': [[
                            35390,
                            -11796
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MRT',
                'properties': { 'name': 'Mauritania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@և־ԗؤ֍ɞГʚҵUЧǽйð˽ˏïҐɺаŀߊģࠨĵкČмɑЎѵδǾˬᾔMǃ௎ȴќ߀øᒸ᪂©F౞Ṗ᎟౽cМ⋅М⋇ƤĻȇי⁙]ųȇ͕ÈӃǕוɼˉoƗӵ˯Ƶ'],
                    'encodeOffsets': [[
                            -12462,
                            14968
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MWI',
                'properties': { 'name': 'Malawi' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɽٓɾથ̆^̤˕Κ؇îઉεǯʱ׋շԲ×עǰϸ·ͶͧɆɳûәЖѵɔʮޮ˄̈Ǉۢǚڼƞɪɉ܌Ѕϐ࠘ƽǜɵ˶Ϲɾଡ'],
                    'encodeOffsets': [[
                            35390,
                            -11796
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'MYS',
                'properties': { 'name': 'Malaysia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@àћֈĶ˞ΈȘýӸԓΜ֛¶֣ęϡĆ˿Öӻ̒ɵͤݑe˳׫Éߑخ঵ښįђӟ֚ś̡۠ҜĠؔȃΤƤƮۈρ'],
                        ['@@أ˹ܯƚॱ@̅ॗ͓̇љୟۅǵߑɾЕóөщ՛Òէǟַӆƕ֘؜˽ٮǀǜ܆άǂ৖Ǻ׾ڔЬՐϦѥǮ˺В¸՜а٪אшڀͼHќыιֆɻ۬ʧÑ֝͡¥ƮЧ']
                    ],
                    'encodeOffsets': [
                        [[
                                103502,
                                6354
                            ]],
                        [[
                                121466,
                                4586
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'NAM',
                'properties': { 'name': 'Namibia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@رٌؖ͡ȃࠊȷ،˯ಒm৒ŅҞ͛Όѡۜѳ৘ǽՆۃࠐ»٢КǆԊƞհ}ԄϝŶÐ₮׌Е᎞ş໴΂یȒհµͨȍPéӁȍʭC՛͍ͣΎಕ̍س{ᲽࠣBយA᷋ݣѕҋÕՇǄϗÔƗάͩɰГг'],
                    'encodeOffsets': [[
                            16738,
                            -29262
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NCL',
                'properties': { 'name': 'New Caledonia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ېԵѨϭ͉ȫҥɪ׹ϚէѼ։פś˶β[Һ˹φ˷ˎɻ'],
                    'encodeOffsets': [[
                            169759,
                            -21585
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NER',
                'properties': { 'name': 'Niger' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nּॹȐОҿպœϤâТբ̴̘ପðݜƄîԮҠ֘Eኬஈϒᝪ࿸᮪ཾ೨αӀңר̸ȸಯ̾ɓ`ˋΔ˽ǻί͕ၻ«ધੳߋγૉΔ̵CեբmčЃʁµˋƻm֩ंȟځҷٱʔҍ¸ʏşӯ~ӷΧѓq৯ѢЉȵѓb̿͆ࡅ̼ࣗıɕǻşӗʋ͹ÍݣٗӚ̟E˭ʗ'],
                    'encodeOffsets': [[
                            2207,
                            12227
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NGA',
                'properties': { 'name': 'Nigeria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࢍ̡͉¬͓ȉڥl҇Ղˡ؊שֆكYݍB¶തs՘ǂՊʶʴТԴėɨǔ͸ȍӾ˪ÎݤʌͺŠӘɖǼࣘĲࡆ̻̀ͅєaЊȶৰѡєrӸΨӰ}ʐŠҎ·ٲʓڂҸȠ֪ँƼnͬͯğƱ«˧۽ٱɛՙšѧǱȉǝי҅ΉŽыȋ͹ÿΓֽ˱ҽΊ͇aԃӭʑQЍ߷ɍש'],
                    'encodeOffsets': [[
                            8705,
                            4887
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NIC',
                'properties': { 'name': 'Nicaragua' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̃ˆϽͺȁ˲Ο˄сϜĤžƒŵÚÒʾŀȔŬRkЮȠrǬOǺɤʜǝĒľƺĲ̊ɴbǦĄQňȪĖ|ƜŹǚȆńɄB̈ŌŜŖ˾iïă§ȉĐ̫ȗ˹ěͷυ®ɏtϙŹĉýΫÌɛǣɋ ɩźƏȩǱʛÈƓǦˉêȕŉօɞųŇ'],
                    'encodeOffsets': [[
                            -87769,
                            11355
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NLD',
                'properties': { 'name': 'Netherlands' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ۦyǀ˳Ƚޓɇ́ԍ@ƘࢡҥȞՏπީǩ؛âѠɲ݀ఆଲΘ'],
                    'encodeOffsets': [[
                            6220,
                            54795
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NOR',
                'properties': { 'name': 'Norway' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@᥆ؙઍɣऄՅෛ͵ڵû΢לઃͰಫ˵Ы؝ߟωࣗȮ઱¥णѼԉɝԷūփནƊɝҵ߭Hևױ࠿झಫ஁̨˹̇ͫ࠯bձ޿¾૟՞э˥ধֻۧυӛ֝Ԫဋঁ૫ȟ୏є̛ࣚˇ኶ޞզᕠ۶ဌࢂ໤୦፺ྴඦلᘼ੊ᇎπ൪­౮ۢ໖ພǘ'],
                        ['@@ም΅๝Ȝ׆ɐԕˎეǚͮ̿ொȍ'],
                        ['@@᪖صᑟͥұأ݅ǁЍۡৣᅵԢނ̘ఽʐ࿕܂ٷڄᘎ̜Ң̋஦\\͊˼௾੖̋'],
                        ['@@࿮̏ఝҍ᝱ı៙ƖƫɴஹdँϬᣴɼ௞ȫࡘʤᑺȽ']
                    ],
                    'encodeOffsets': [
                        [[
                                28842,
                                72894
                            ]],
                        [[
                                25318,
                                79723
                            ]],
                        [[
                                18690,
                                81615
                            ]],
                        [[
                                26059,
                                82338
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'NPL',
                'properties': { 'name': 'Nepal' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÝαŌՕĩͩ۩aয়Ȟ٭ĂӛђଷŊયҼ߉Ю߿͆͜޼ՒϠΒȪڪʳࡔշҾť˰ЕٶǓۀσौȕঔć'],
                    'encodeOffsets': [[
                            90236,
                            28546
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'NZL',
                'properties': { 'name': 'New Zealand' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Ȓ΋װ;ʐΡBΝ̹ϳչإїͷ̴З٭Yܗ̓ɣջӋࡗڇϓнʇޝlխˢࣱÐƗ̰Ҍذ੐ࠦժǀ׾͌ܜѰԎѦώظ͈ɆŰҶלϴȆΧ'],
                        ['@@،ࢫlָϜɯŲًڰ˛֨ãӒ͎юĭȯݗʯӫٛjɡʭþαūƻͅҏзֹ٭ͯƟɘΕŨӞ۔˟ҨࣛͲz̦؈̌ƚ٨լͻ֜vƪБΎڋݔΗת̸àҚұٺɑʂݡ']
                    ],
                    'encodeOffsets': [
                        [[
                                177173,
                                -41901
                            ]],
                        [[
                                178803,
                                -37024
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'OMN',
                'properties': { 'name': 'Oman' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ֹ̻ϟªǩȧƉэļ֗ÿĻϯFԽ̻ćХȓǯԹP͡ɃJͻПɷҩĂ֗˳ϱ³˝טٿ൴ᠾ࠾֖၂ϩתv͸ʔΐFΆϞǒƩŞèմіHϖֵҸ̧؞ŋӼƳϜӕɨ˧̞ŃCȉ̩ԃƅɽΟˏ'],
                        ['@@ŉƳǅ˺ʔ˺ľñā΍']
                    ],
                    'encodeOffsets': [
                        [[
                                60274,
                                21621
                            ]],
                        [[
                                57745,
                                26518
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'PAK',
                'properties': { 'name': 'Pakistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@تϻʞ٥൨ͻ߹۷ऩůౣȲЫα̖݁̈֩ڴгܑӟ`׳ࠃࡇՃ࡝࢝ࢡউÚऑࢡռϗĪ٧ҾэǘܝᇛD֓֕؛Ɇʣ؀٭٘໻ǁിeஃŝ̈́ঊொѢéϰГƌw݊ߥφͷԔеѶඨѕࡀŲԈŅǞȂגóદΔ܎ҶӈشCĠɼٞŌ̴ý͢ʀ±ԌΦԖ՘Ɇͥ֊ߜɴ̢͒мΜĩмȣΤӬμࣘǮ८ĮѐƺӨĦ'],
                    'encodeOffsets': [[
                            76962,
                            38025
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PAN',
                'properties': { 'name': 'Panama' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@˫ʎǵҒȺɢɅÎƿˤлɸοÁǝ̇ͻɁǽĉǩВҗɯŅŧŭϷ©ơԈŋƛˡ¸ǝ͸·ÈɓİέCǻĩŶªǖìǠƲŲĲǩŲK͸͘ö̠̝iǱͲĀæɴȵЮÔΨɄԜǞ˺ʤҬ·ĉҶώơ˜ʧ̈́ɵĹūȜӵǁʟ˓ÒŅС'],
                    'encodeOffsets': [[
                            -79750,
                            7398
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PER',
                'properties': { 'name': 'Peru' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɥљћɋࡅӘñΈရࡊທࣾ٫԰ΏۜƐʎ܅ાࠣ༄ߍီ΅Ϥ˃ؤٷպױͼ˖ϒПߢʼךڢՎĲΓʇȧx̭ΎâͼĝΚщӆΌǄ֤ԦܶৠͨࣸࢠʾմŝٔɢĂ֒ЉˎЅϴɏӶࢣضĿҨɞ̤ƣԎð٠Ͻթࡣʤoрҁݳ œųۍǉ॥ֱÓϻɉ̇ČғԕʍBΡɛƵΔݳҲԝǱί֐µ͆҃ݐuېӸÇ౧ϢĩӄƠܪടǷ˵£ןg܍͟пƮ̵ȕ˯β۹Ջ࣡'],
                    'encodeOffsets': [[
                            -71260,
                            -18001
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PHL',
                'properties': { 'name': 'Philippines' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@Đ֏ºҽ˹ޑ̫ࡨϽэˎإʉϿ঩Ӧɿ؊ʰЎՑЈˁΑЃثҵƑʖ͢۾ՌʀҜ̈́̔ϝٔɰƎϒרv·ٰڼЋêхÐ̱'],
                        ['@@̟ˡˁՍ˃ʝԫ׈ǦɤɂɾĢԸҨ¸Ɖ֣جߺāߡ'],
                        ['@@ૣߕЬט؈԰Ԏ׊Ѱ࠲Ʈۅևҧѳֿ'],
                        ['@@Ԏʹ՘BgΗϳΣՕʧϸÒєŽА'],
                        ['@@ʀभ٫ɞj˭ȶԯЍȋעʧªƁԘӶãY͈ԣٜ߮mɴ̻'],
                        ['@@ɟܩέоѓ٘ܚ̡̈'],
                        ['@@ԮʉʶɖüɇƍΑ˼׻ɛۥӷ˥ƁڳȊڝѾġϊĲਾүăҙ˜ȫēϯٻЮ̵Ѵɍ̯՗ԊރůлȆ¨ΎˀɊʣȘŇ̡бӚűμߨͺˡĔೄ˜ހԘA']
                    ],
                    'encodeOffsets': [
                        [[
                                129410,
                                8617
                            ]],
                        [[
                                126959,
                                10526
                            ]],
                        [[
                                121349,
                                9540
                            ]],
                        [[
                                124809,
                                12178
                            ]],
                        [[
                                128515,
                                12455
                            ]],
                        [[
                                124445,
                                13384
                            ]],
                        [[
                                124234,
                                18949
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'PNG',
                'properties': { 'name': 'Papua New Guinea' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ɽčε͔ρՔǷ٘ŜĆĜʡʬȏРՑЈ˵ŝɽ'],
                        ['@@ѯçƃɽҟȱћȟѽBۏʔӑɺêʺݬũҠàŶЖŦrĆѽӐÜʂ˼Ҹ̚ġӸԌfǜƏgү˯ԡ'],
                        ['@@ݤտղࢻӖω٬ƛʥǁࣀΝġʏ֋ÏȷɔܟĦࡕŴٷ՚ӉҦѧ݀ભπ܇ʇԡˣńإڇ˿һƖࢅaᩒaᩒภ׃༊ӓׄїҴхŸӵඔԱȲѽޛěȄ֕'],
                        ['@@ʿɡǁӸȝ͘ϝ˞ӍΪ؇ʚɺȮҒɻ˸ȁΜȫʹΛ͊ˏĶѧ']
                    ],
                    'encodeOffsets': [
                        [[
                                159622,
                                -6983
                            ]],
                        [[
                                155631,
                                -5609
                            ]],
                        [[
                                150725,
                                -7565
                            ]],
                        [[
                                156816,
                                -4607
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'POL',
                'properties': { 'name': 'Poland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@·՜à̂ȹ̧҆̚ɺɤȝђָʘ಼ϴ੒˴࠼ƙÚȱ߸Yਚħ໶^њěȬʵωɸ͋KͯԋǡʸϳfϏцܻěɽзįރۥɒϗǿ¶ߙ͔؁šЇĒӹǵч̖Ήŕ³¼ϭаر¼ăˀֻĦűɑҗǨÀɴػòЉ˔'],
                    'encodeOffsets': [[
                            15378,
                            52334
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRI',
                'properties': { 'name': 'Puerto Rico' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@јõưǕɋɃمLӫ·άŢŬیK'],
                    'encodeOffsets': [[
                            -67873,
                            18960
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRK',
                'properties': { 'name': 'North Korea' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Şƥ͉ºη˵ʣ˷׽ѣȅƫƧ̓ʝ֓ƏηɥηįġͰƋӈσŧȭΧÇץ¡͝ϛϑÁùСǆĵƿʙéǀɑüɥƆɰφȤİõƶɆҒÅƎөĠЇɤۄբऒҌ־׮ЎˁܪſѺಚβͰҼժӹ'],
                    'encodeOffsets': [[
                            133776,
                            43413
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRT',
                'properties': { 'name': 'Portugal' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̦Ɉ΄ŬɂЫӺDƞłӪɼуϱɩYٽƍūЇγçʹԋɵտ̄ʡřɫ̵̿ê˥ͷɓѷŠџġŸڂÿԬϓþȩ͈äռͰ̨ÒͼǪԎkΤǙ̠˲'],
                    'encodeOffsets': [[
                            -9251,
                            42886
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'PRY',
                'properties': { 'name': 'Paraguay' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ͦ৖tҌЖ݌าʔޮ]޴їbʵʞҳÇଛࢲǇ΄ǐ֦ɩǀʣþޓİ͓̼̀ƌ̢ƳAҥŕӻǑӛƍݏށ١ړƇऻŸࡑɮࠢ౨ťψࡽ͢ਅبۉŸ໵ൌ'],
                    'encodeOffsets': [[
                            -64189,
                            -22783
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'QAT',
                'properties': { 'name': 'Qatar' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ÇؔɨѲɰĜʬˁdӯǽӳɵÑʫǖ'],
                    'encodeOffsets': [[
                            52030,
                            25349
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ROU',
                'properties': { 'name': 'Romania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@δǶԴġՠGϸȳ˺źبĄɄȠΠ@ʰćʺʟˊΟӞԁρėΩưϥϒƹЂƊϠƟpɏПǹʯĀɻ৥ӳĖ̪ؑফțзɋ௽¬٥ƀ͙ÕʍΊƵƦȚƘȷŀ˃ȋөʔßΌԟȢĥˌҕͤڪǂԖ֮Њ֬ԢǮ'],
                    'encodeOffsets': [[
                            23256,
                            49032
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'RUS',
                'properties': { 'name': 'Russia' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ࡌ๫కˤԫ்ࠌࡳyוُԒսٱƻ۸Ĥࠊħ࣢Țٌ૴ӯࠜôରަϮͭϴϐŠɔ։̆ߵuࠟΎࡑ'],
                        ['@@໵]ਙĨȒτ୊˚ࢢƧψƃęɱäɉ'],
                        ['@@֦Ƚțؐᗸű࿨޻࠭λ൛ēsࠑͳǩ޽~ٗ̊ૣʖȉθ࡟Ǝॗŉҗ̎Ǽ̸৓ȥϚЃӉΣ@„Ꮪٛᔺ࠳ïԷ'],
                        ['@@ः©ƭˌੲΖ@ַ'],
                        ['@@ળ»@ָň܈E௒ʉïŗࡽȩ'],
                        ['@@ౡMႣĤƧ¬ߘͪੀþஞ͏ĸə'],
                        ['@@ॿͩഉø༛ͨȪ˖༨ųᑔɗ'],
                        ['@@ډرᶽzඃȣမղҎ׀૎ǂᕞᴬѽ'],
                        ['@@ӹóᩣŊɟώູɦūҒ࡮ǶҞသܒޙĺ፨݆ɩϢሤѺ᪪բ᫠ǀ෴̸࿐Ŋאͩ֟ʻᲗз᢭Џᤙߝఫࠍ೉߱Ǡۥྎۏ'],
                        ['@@ɨгސȲឤYቈЧڬ̿ȽѧङʝᕅүفʟਬşఖɃݴǄєաτɔഊƂ᧪ƑȴϽ↲ů´ٜᄼƥഄLബѷϮ՝ӹΙੌڋ೔Ϳ߸ࢦഖϙ෢ɦྼʵؤʀൖş؅ޮૐζ䢀ձܐӿᔲٛ₎ǄာƑ۪΍Ĺؙਜʇ૴Ǥ๰vཚǑཪĢะݛਪˎڷ՞ϐώᧆɻფºᝂБ୲ν@”MKઇσઝÖݶҁԄەϲɧĮΏɑɝ༧Ǿ᚝مݛĭ౽ן௛ԧ̱ϣய׊ᔗڇϣ̸ߵΫ૱Ř˓ց৙߽ͻड़ȋő௣ޭΫ۱Δα฽ѕ̅ॡభȳʥ࡟ே޳ׂ̳έ௬ҵለИ୘܀ԆªϾರȊຊ੒คࡺຢڢڮஆ৷ëԍۗᒉइۍਖᓧ˷ᑃටۚԧሙɕಝēÔ؊ಯŶ਩ЭᢵƠ᪏ʟᨩ࿛ủጝ೚ŁаՃࠄȅ՞оईÃௌऍ܍ځ࠽ë্ϛഉ్௓˯ׇଙ঑ଇॻթӹ૩ӱՉYՇФૻؙſ˩ŝƦKѐіxŦ঴ɛܚܞ̒৶Ʃ֢ࠈ˾ऄ͚̮Ѵݲ൷ʛܯͧ౧Dͻ߄হװหˎ̵ࠖ̉Ԫ̿βԯࡐ̲݇షʢ૛uਯƱۛлҤȥXҩұˑݷࢻRσஅՍ৙̈́োéѯˮԋĞ௷ףેƑޛȻੑƌޫSԙіࠕИࡅŎ੝ŋߏƹ஛ΜǇـধɎށİवΎࢉࢉ΀ӵࠇב௏ɂ࠻֗Ͼ࢙^ܳʴ౫Ѓྃܣࢭơ͡çѽԤઍőΧΦחǌЙӠҩưிɍୃӜ҃ѯሟᒒੵٮ̮˂ᑋߍ߭³êҞઅ˺࢙ȱ˃ࢊມǺݯΑᑅ̳Чȹḭ̇ϫ˻؆ֹ߭ɓǀɭ߭ХസֿɁЉ୻ʓʟ੹Ѧ೯iࢻΟহͼᇡ׊ಽsჃࣳĿؗࡹӤڡउʖǡӝُ܊֫ذx՚֗ďѝѐƋϥӽ߿Ƒ࠳ࢁކߕĉ֣ࣼফԇ͹ƝɇωÌֿԚɿՅȚʳΈ޵ǮԙƁƥƼଥЖఅƌ܃ƞĹıੱ܂य़̈́ܩӴؒƈۤ۰ҹͪఌ΄uȀݯƉώѠɼ߼ÖƄ˪ȅҪ΀ѰWʚఉ˚ӭUԯЀ١ƃ੩̐lǒ̗θڟ¤éʼɀǞ՝ӈࢋąʭ¦Ƀȑ̽ȷ՞ȟ˨ǊĀڴ͞Ȁʍɢ֥ƪ¼Ʋ΁ƴՃվǸɨĉЂࠑȨѱĳšȼࢭɂˑӸíТЙȖάˊʝ޶װӞųƤक़ҬࢡЎᅢ੶ޮӠ͂єగּΆնݳش֢ܜ঍ग़ޢي౿֔ŬךڶüොͶࢀ̈൦ԕᘨȧṺो٤ЋÆ֓टѳ൏ɡ⏷ٔ؟Ńൌ؛ÂϵÆ࡫ઌʯڂɓňРԑΰ՘͈᎖Թ۾Ȳ֣؜ዦࠖޢµ޸̋Ӫ׀۫ԄЪԊءԶᚠˑӔҹ੡ĻNҳڌ˽ಜǼȶ՚ჶАᰪܞي£ࠣԙਬĕ׼˼༾xఢΐफ़ԏॖ֌ࢡӢѪˤ២ʫ୒ʿᴾॣ֚ѰࡡѺ{ǴৣĈˢЌ҅ټ}ː༄ݾրކزǒᕮɛǬұߕڽԺˋ˒חȏଵऒԧέ֕࿫஝०ŭ̢ͮऎɎɞжܮЎөӌϼֈࣿêȫҲڢࡈણۆຒ֦șװмnѴүͧ߷࣐Ƶϥ؄ඤͦლ¬༈ӏݛ۪ċࣆศǞ፾ᆘŌہѮংւॲx࿎иᕠŐ˪ɲᕂþیȋሴҀ໲aɶδߤΨጤΈ෸˗ଥȷበŹ'],
                        ['@@ⵙ͕ໞીےĦقÃᒈӋʟͿ'],
                        ['@@૽ōݱÛśƏঙƑ࣫ȦӐʾል~࿞ƶ౨XǢɧӘȬߊƐఞǿ͗ŷ'],
                        ['@@ᆳĿᚉʎඅ͎٣׾଩ǔᔆָᆎȎ࿌чኬ߻ȹݯ']
                    ],
                    'encodeOffsets': [
                        [[
                                147096,
                                51966
                            ]],
                        [[
                                23277,
                                55632
                            ]],
                        [[
                                -179214,
                                68183
                            ]],
                        [[
                                184320,
                                72533
                            ]],
                        [[
                                -182982,
                                72595
                            ]],
                        [[
                                147051,
                                74970
                            ]],
                        [[
                                154350,
                                76887
                            ]],
                        [[
                                148569,
                                77377
                            ]],
                        [[
                                58917,
                                72418
                            ]],
                        [[
                                109538,
                                78822
                            ]],
                        [[
                                107598,
                                80187
                            ]],
                        [[
                                52364,
                                82481
                            ]],
                        [[
                                102339,
                                80775
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'RWA',
                'properties': { 'name': 'Rwanda' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ͬӃµӵʏŁѿÆʱӍԛàþҠŘÞԄʎɺȰďԈʸ'],
                    'encodeOffsets': [[
                            31150,
                            -1161
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ESH',
                'properties': { 'name': 'Western Sahara' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@oҊŸ@@ÉeǋEౝ᪁ªᒷ޿÷ȳћǄ்ᾓNǽ˫΢bCቆäĶ̢ΆϘˤୌୠ࣢Ђ੖ˀÖ˜ټۺĜ̦ŉϢ@˔ȒԲ'],
                    'encodeOffsets': [[
                            -9005,
                            27772
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SAU',
                'properties': { 'name': 'Saudi Arabia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ŉΪʩʨÝͲѡ̞҃۴ʁۆׇ׀ϑƐ֋ߠīאӾӕञϿ͠ґǨˡӖ°ȎɹѦʕȊ͝زԟڴѓ־лIžҦ̌ļͲनƅζʶȪ̢ٚŚƒˮˤƜ࠷ࡀ၆фǆŴৢɩబיᛎၕ༠ãݠąȾЏתv͠ܥаȓƠִ̏Λ¼΍ċ˩ł˯ʎɽŐ˟ŲȵʬǕɶÒǆ͍ș࡙͐ᡌщǞǲϪש֕၁ᠽ࠽ᝑ͑޷ϙ׻ࢥϹƕɁˬ͏§߻ĎƷČॹmɫùΉɔɝЭĒΟρˋ'],
                    'encodeOffsets': [[
                            43807,
                            16741
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SDN',
                'properties': { 'name': 'Sudan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@śhdмĵ̀џͨĵ؄ĶبϳÌÍȇԍ©Ȭʕðԍңңл؅џđ۹Ӫͅǥđʓџǃǥ࠵@řǦ؃̡ƝɳîѝӬƟɲ؃ŗɱϵɏݣ˿ǁʳğå ̅ʎÃʼƌΔE΄ӛՀĩάZȰ̱ʜUӦǭ͖̍µĎ̰ɒΖħΐˢʴǫȞɞ԰ϨئܦÏ¥ ZΚॲH@း⁪@Ὂ@ῼ@˔ࠗȁƳŪࡻ্̰͌ȷҠ̳ыӑأƏ˅ʳĉ֑α௿ĚͳƅܟͿࠟԓзέٛč΃Љɽʝ࢟Dĳ'],
                    'encodeOffsets': [[
                            34779,
                            9692
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SDS',
                'properties': { 'name': 'South Sudan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Xٽűʯѿq˷ӏԨÑюХƨͳϦșӼࣳ֫օԫԇԫϭסFگȟՕȊ΋ɭ݉֐ȥάҵǱϱÆɣƕϗĸԗۚƉˊعͪɅԌΕζ֟ѬS˘ҡͼ֯͠ʴĠ̀ǂɐݤɲ϶؄ŘƠɱўӫɴí̢ƞ؄Śǥ࠶@ǦѠǄĒʔ͆ǦۺөѠĒм؆ҤҤïԎȫʖԎªÎȈϴËĵاĶ؃ѠͧĶ˿cлŜg'],
                    'encodeOffsets': [[
                            34779,
                            9692
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SEN',
                'properties': { 'name': 'Senegal' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@΍ٺн̚φǄРמȦќ˾ːкïШǾҶVДʙ֎ɝԘأֈֽԹǔӓ̾ɿî͗ʽŧ³қâÙģȃk׿ȲЛV༇ɥħ˥ѻƋƏ٢ވkȬŞƮR̸ȘήǯκcζȌǝʐˡƙʻJͧȸˉ_ȍȥࣵy'],
                    'encodeOffsets': [[
                            -17114,
                            13922
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SLB',
                'properties': { 'name': 'Solomon Islands' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ɾ˿חN͉ԬԈȯǜ'],
                        ['@@͝mԧĎǫżÀͮֈƁ˜ǭƎə'],
                        ['@@ųƹحܰǫԈ˺@̠ڥʹЗ'],
                        ['@@ǛڅΦҟ̠̿˪ŰĐϮȫېϭȢˉ'],
                        ['@@Ǘ³οȒ·Ί¨ƖԈΡͰ˛']
                    ],
                    'encodeOffsets': [
                        [[
                                166010,
                                -10734
                            ]],
                        [[
                                164713,
                                -10109
                            ]],
                        [[
                                165561,
                                -9830
                            ]],
                        [[
                                163713,
                                -8537
                            ]],
                        [[
                                161320,
                                -7524
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'SLE',
                'properties': { 'name': 'Sierra Leone' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɧØ؁ͺѩ҈Ƨ̬Ĺت҆τĬɺƞǸɶpȜǂڦCɺ̛ǼΛʓƈɗṶɴ´ϹϹϛҗ«ʓȩˏ'],
                    'encodeOffsets': [[
                            -11713,
                            6949
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SLV',
                'properties': { 'name': 'El Salvador' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ġȡӡ^̡Ą΍ǘұÀʃǶ~Ů˾ɄǀĢ«ĲȠ¾ʜëǸǙʪƇœτĴǤÑŘĝÏͳ'],
                    'encodeOffsets': [[
                            -89900,
                            13706
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '-99',
                'properties': { 'name': 'Somaliland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ϛԩד۫۹Mᩧা͍̜̳К̳ҨǾ̖̲҈˚ƹǒΏϜΗкGߊɌࣴĴ݌ʼиÆ̚ƶӎKaE΋Aࡑ@ѫ'],
                    'encodeOffsets': [[
                            50113,
                            9679
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SOM',
                'properties': { 'name': 'Somalia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ѼĎЊ˾͈FpɵýӧHѳǯ̣ʁࣥЙयԱ੷ܝ௷ܓवধ଩ࡁڹష࠯޳ٕँৱȗѷȍȣӽۚWᵤܾ॒ɰˆբfݠפબᛜᡄה۬ϜԪ@ѬBࡒFΌLbːhϰŰ'],
                    'encodeOffsets': [[
                            50923,
                            11857
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SRB',
                'properties': { 'name': 'Republic of Serbia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ԡȡà΋Ӫʓ˄ȌȸĿșƗƶƥȷȏø̫Тγ͋ʿƗˋĞĳƑšϳa˹µØĴĴĦȴšKǍƼƑ ŋƆƽÀšŠƯ±ś˧ȩÑèð͋Ǩ˟ĜūŜɟƠȢŬЄЛ͔ɀτ̥Ë͔́ˉʈȱ͘٢ɚԾҖͣĦˋ'],
                    'encodeOffsets': [[
                            21376,
                            46507
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SUR',
                'properties': { 'name': 'Suriname' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@৔ǙĞưڶÔࣚɥѩܟâֹͤӽƥίóϩɉΛӓǲЇđ͹öčʏƘǗ÷ǡҙèԡܴōӄˏBωؐƺѠ¯ȤԜɖƈݲ'],
                    'encodeOffsets': [[
                            -58518,
                            6117
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SVK',
                'properties': { 'name': 'Slovakia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@´»ΊŖш̕ӺǶЈđ؂Ţߚ͓ɷɓǏ͹ǳđ࣑ʮ˟»ȟȡЁĿěÄХŽͭ}ãǙ۷Ļ̱ĠёɌċ̆äńŢȂόa˺Ĕxþǈ¢ÆȒȖžưʢD'],
                    'encodeOffsets': [[
                            19306,
                            50685
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SVN',
                'properties': { 'name': 'Slovenia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ۜÝъȐܾtǈƘƘUǎ˳ڝɟć͹̇đHɻͣh˷ƎƷƙבȈúȫΨĞа'],
                    'encodeOffsets': [[
                            14138,
                            47626
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SWE',
                'properties': { 'name': 'Sweden' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ࠁוƀԥ೹ڭྱܡؓஃײףߦүޗॅ࢑ȝ͍තӋ޿৳ĆӅڗঃˉߐ۳॔ٓஐφӜּۨ˦ন՝ю½ૠղ߀࠰ä̧ͬ˺ಬஂࡀञֈײ߮GɞҶཔƉŬքԸ૪Щ಼ֱv಑˴͛ฃʃ'],
                    'encodeOffsets': [[
                            22716,
                            67302
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SWZ',
                'properties': { 'name': 'Swaziland' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ǡύӭěԅҖS̄ɰ̀ĂʔʐÒшƵŰϕðω'],
                    'encodeOffsets': [[
                            32842,
                            -27375
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'SYR',
                'properties': { 'name': 'Syria' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@࿩ࣅऩͬgNŖŶ_ΈȸҠҜ̈́Əͤϗ¨ÿٞȶΌɤȀɤȀ°Ҹ˞Ǐऎɺ҂ƿۖFॴ̀Ґaक़žїԽҡȹĂؗͅ৫ᇵ࢓'],
                    'encodeOffsets': [[
                            39724,
                            34180
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TCD',
                'properties': { 'name': 'Chad' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĎЄաnDզΓ̶δ૊ੴߌ¬ન͖ၼǼΰΓ˾_ˌ̽ɔȷರࡔҠ…ྑ…ྏ¦ ܥÐϧإɝԯǬȝˡʳĨΏɑΕč̯̎¶Ǯ͕Vӥ̲ʛYȯՏƛэͽ؉ࣹ߅ϳ߹¾ʁûĊ̏ѫ̋Σ͟੓͏ȽȐƓhƹɍۛÙƀɪ˅ׄşΐλƜӷӪǼІϦċʂÐҸSқކ֐É֐ͭՠ'],
                    'encodeOffsets': [[
                            14844,
                            13169
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TGO',
                'properties': { 'name': 'Togo' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ڱǳȇ̎ɡՔãкȆݴɁ̬ăڎD؎ΕѠÖˀ݂kŅѵʲʝ̈̋ЭǜǥኝȺׅ'],
                    'encodeOffsets': [[
                            1911,
                            6290
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'THA',
                'properties': { 'name': 'Thailand' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ݭϬܗeŬڈ݉Káऋґ௯˙ݏÌ؋ն΀ދưܭҶӓԚĭѤѧ˝·ևĵßќۇςƣƭͧ͒ƝжҁӄПЌƏӳǃҲĠԾʚ߬ТࡸҤ޶͟ތ`϶ĩҸ֕ښȩф̄ƺ̮ܶ·ֆՓؘН݆ΠƴϦࣦצӬθӔȘθʷ´ԍ֨ȷࢭpݫࢰԆʤƧӰzǜَ̊ÍٖڽÀࠥںܷ܅˙ϛ޿Ŧગǅ՟ۧȤ১'],
                    'encodeOffsets': [[
                            105047,
                            12480
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TJK',
                'properties': { 'name': 'Tajikistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̭ʷࣳƖāӛ࣬Þਢ˗འŶɈާˠĐԜȓ͛ŴӍࡿBׁØԻϕύĉ̉ǯͩˠþ۸ʩ¢ĞʲғȐα̇ė͹Żūԇj˕ϩ˯ǌ؋ˑʱĺӀࡘǹض؟ȨɔφۮЌҬˌբ૲ȜǩϵŤɹΎv'],
                    'encodeOffsets': [[
                            72719,
                            41211
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TKM',
                'properties': { 'name': 'Turkmenistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ñۼطॣݔڣĠगюׯþσƽ֙|ׯӓ݇ǋƻרŪ࢞ٽ˶Ɏֺ֏¸Ȇ۾ߊȵ݈ˎؓԎʉӔڱɋď؛ʿհψ˨ॖǪ֨ɻךڅњ¤ॆ\\Əцܖ̂۾ӦଆѹĜڡ͐ǣࣦˮƳаࡽ०ׇոЃ࢞Щ૤ΫwԥʩЅɤſ̙۽ǋǙڥӁʭڏŵǫϟهŏࡩ͈'],
                    'encodeOffsets': [[
                            62680,
                            36506
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TLS',
                'properties': { 'name': 'East Timor' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĲȤܢȌזˀŀ͆Ľ̯ɫ࢕ο۳ʋeʬďǔ'],
                    'encodeOffsets': [[
                            127968,
                            -9106
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TTO',
                'properties': { 'name': 'Trinidad and Tobago' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ӚŊǮصۭġƯúʒɲiͪ'],
                    'encodeOffsets': [[
                            -63160,
                            11019
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TUN',
                'properties': { 'name': 'Tunisia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ΩພԭͺQȰۉԄóنԮҶȢۚƃߠǠќࣶͺךĵ}ы܊̲ÒǉпЫMϱ̆ȽōܫփхǄқѤaɄЍ͊ſ³٥Хʋʵˏֽ͓ĘΑïΟЧț'],
                    'encodeOffsets': [[
                            9710,
                            31035
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'TUR',
                'properties': { 'name': 'Turkey' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@஺͗ঐżܤõলѬࣆ¢ߴЭƜ̑ăУزȻͨʕֻʇˀ५ǏʻҠڧЕƙ̏Ɋ঍ňίŽॗŽҏbॳ̿ەEҁǀऍɹ˝ǐ¯ҷɣǿɣǿ̱Ϡ͈͂ԟí۱ȖֿәౣĥڹҊࣟȗΑׇĳ߻҄ࣻeӽ࠶ؗҰЦٸՓВठߨಒΜྀٔŏ৞հ঒ʄർlุף'],
                        ['@@۫ҏ˃Ϻ\\ǦȦĦʺՂХɞࡦ˄ܤőĴ͓ܼ˓Ƶȵি±Ωʷ']
                    ],
                    'encodeOffsets': [
                        [[
                                37800,
                                42328
                            ]],
                        [[
                                27845,
                                41668
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'TZA',
                'properties': { 'name': 'United Republic of Tanzania' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƚġᵂႋÌӣ஼࠿ϱਙ¸Ӊՠ̩~ɓɳԓ¶ʭÇГ̌Ճΐ̰ࠡǿڝӣࣿ͛ԋb̙ʥבsɕŃঢ়ʂكåɽଢ˵ϺǛɶࠗƾӉʨՕƘͯƘΗɈґ੖ӣҺǗӤČѨƯޞΎ ̨̦͜ѬȺǮS˘ǷȐ·ͨʐł¶Ӷͫӄ̎Ķऄ[ႎà'],
                    'encodeOffsets': [[
                            34718,
                            -972
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'UGA',
                'properties': { 'name': 'Uganda' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ः\\̍ĵԇʷȯĐPوȜ͎²ڬǰϸ͎Ѭ͔ɠ˒̘͵Ŗ¼চΌɮՖȉڰȠעEԬϮЊ׍İсτ९̧ؓЯ֋ʉͽTࢹႍß'],
                    'encodeOffsets': [[
                            32631,
                            -1052
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'UKR',
                'properties': { 'name': 'Ukraine' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@̾ɄȒʮ¥ࢌĆ՞Ӈȿǝêʻڠ£̘ηkǑ੪̏٢Ƅ԰ϿӮVఊ˙XʙͿѯȆҩƃ˩߻Õџɻύڡã֑˕޽«ܣ̻¸ԹЪȭࡨ¼Ǐ̛ँơଛӟұǠȄЂࣽʘƨǈߪ˪ʑȔಯɆË̼ީĻ̷ҧٱةϟƠЁƉϑƺɂĞƦ˾ɲˎÑƮǬäĊśӸ{ɞØƽĎÐŲ̉ɈŧΘ̩ƐÒ˶ϝɦΉأʾ֑ĉȧŭΟ@Ƀȟاă˹ŹϷȴ՟HԳĢγǵÍɤұɮǐͺɸɔȀµɑϘބۦиİĜɾхܼДҢɪٲnࡖßबȫڎi͂ŧ̀Ʀɚȝݸ¢ͮąÄцʶȂܞº'],
                    'encodeOffsets': [[
                            32549,
                            53353
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'URY',
                'properties': { 'name': 'Uruguay' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ղĚࡆٯ̺|ࡺ՟ڈҫӠֱχЉɸӇεՇॉұاǚғěޥΰ֫ԟҬÞլǾȈS࠸ɤࡺȾڦ'],
                    'encodeOffsets': [[
                            -59008,
                            -30941
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'USA',
                'properties': { 'name': 'United States of America' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ũƕȽŤ|ɾƓ̨¦ĤƤƎÍǔ¸þÜe͐ƙƬñƌőɊ̍q¯͟ǵˏſ'],
                        ['@@˭ÑƟǮīèQÀĈî̘āɘŹëĵ'],
                        ['@@ĝ҉|Úĸа'],
                        ['@@­µÓŻŃȒɤŚêÃʐ˥'],
                        ['@@ıĉ˱ƴªÖŸĈȘijȝ'],
                        ['@@Ƭңʼƛז½࡬ƅࠂʹڼŊਖɓ˞Tݨʄ߂̧ࠒ͗ں˩ٶˏĈəȢĉ½ĉɦǎĔ¦ȣǜƅɴ@ŬĹĽƫ࢖ЁǶށǚܳʗӹЁҥȁ̍mēĦť˸Ɓɂ@ঊ҆ࡾƀસмfĐ÷ʰƉǒϜƆࠜHޘAˎ͞ŀàࢶ؄ϜƸ౦N໾BĎȺː¦Φž̖Ϣʲٺٚي˨ə֜ƜώʏAଧռӅƢ˝࣋Пࡷ̃ࢱʝѻӿƛȋSѽˤѽΒsė̬ʦȇãʇ֥ƋЗhةƥλ¥ӥ¥۫ʏఀǂʠǃ୳ʥ՗C|ĺʭɷʚǹ׽ؑ٧×Ɏȁª˟ɀǪҍȼƭ^ͅˏ͛ҿڡûʺֲѕ͎įۦǉεǴՑևƀׂ˓ߛʊÍĖ̃ŠࡁՕدࢇʝցӱнÁэ̱ţ˭इձӁЍЅӽŻׯƪ׍ˬܗώשLεЊঅ֥͛ȿԡʣŃЯĺƁς͋ȖѻܢϹٞű͢Ǥ֐ɽҦٻ۲͟źࡑϡƭ¦СϼՃȺोŁݗĤٙÍΏſƲɟaͽǴǓǇō̵Ů́ǃ؍طѺܻĿ؏ȚԹÏۻȝއح࠳γҝБȕϗUׅ¨ЕǄ˹͝{׭ȂٽʺɽЄȁטӷӐ̃ӰуֺףͲۉgՉڑۣʦѡʪȽҦ˧Ѯӿτїˈ̩̖ป@C΋ڗ@ဩOቿפ౓ТĀǒ੩ĝॕÝƙіխӚϻĴğʌһ¦̝ɪޭĊɉƌĹҢࠁࡊ۩ୠȚχˤٯ۴řۆ҃ҞȀۢܜˍ٢͠ߊĸނĺނƱૼˇܘʓ϶ĸǐ௒˷҂ߋȺɜƇې˷ێᛸ@᠂@ࠜ@ᢢ@៚@ᡀ@ᡄ@᭰@ᮞBაAF͔˴J'],
                        ['@@࠽͋ѕɐŽЀބ̘҆Ÿ֐ÉΤʻܫЍ'],
                        ['@@ԧŽսƾԛɮࠦƞښùĂ͑'],
                        ['@@԰ǅԾĒڸɛ࠲őéĝُǱٕǾ͋Ʋݍµȧôº̈́'],
                        ['@@؊ϛώǌහ»¹ȕ౾ƛࡨČᄚ˅ྤā٨ŉ૦Ǝౢʧࣲŝ@@MᷱIⷍࠠ{ࠌɵהρݜցࠈҺࡈ˖Ҁѡ֤·ޒϙՂ׽࡮य़ේ՗xՋұЙҥ͂ݍˌʃܺએںҍߎ߯Ä೷rটʌ჉ࢎߩǄ฽̜୑í࿻ϬৃΨटǯǦ׏ҫÁঁǫ݉˱झǳťӶϚࠚࣀʶɱɂੱҵֵ֑௅ױؚСߏ׿ࣗΗࡁʱȻωಽѡ˅ϿছΫֽÞ޷ɻ࡝˹ۧ˫෹ʉſƘऀϾࠔʸࣆҠਬĨвΈ୘ԊȈǚب̒ƢْђӸॹʫ˓Ơҕ̧շюɧ̝̽м࠿ͳԩBïԄƲ̮ե̚થǇ܁ЀַȬIӈ٩Ϊ͘ӘۆҸ̚њںÖ־ƇڴМ؎ï٘ʼƻϨҹưج͖ԩWࢻǽʯȃڏȄஏĥ௷ȬΛ͸੟Ӧ୾ΘመШ۔@ŕнᄢڽԶਕ͌ױр߫ΨଽˈҺѲ๰ਗ਼ϦȨФ࡬ЎࠊĪཪώޜÉಐ҄ౚǭ']
                    ],
                    'encodeOffsets': [
                        [[
                                -159275,
                                19542
                            ]],
                        [[
                                -159825,
                                21140
                            ]],
                        [[
                                -160520,
                                21686
                            ]],
                        [[
                                -161436,
                                21834
                            ]],
                        [[
                                -163169,
                                22510
                            ]],
                        [[
                                -97093,
                                50575
                            ]],
                        [[
                                -156678,
                                58487
                            ]],
                        [[
                                -169553,
                                61348
                            ]],
                        [[
                                -175853,
                                65314
                            ]],
                        [[
                                -158789,
                                72856
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'UZB',
                'properties': { 'name': 'Uzbekistan' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@xԦૣά࢝ЪշЄ॥׈Яࡾ˭ƴࣥ͏ǤěڢଅѺ۽ӥܕ́Ɛхॅ[ᶾᓘӺƾïದ׻یͅߤݵঢŪ෸à৔ؗÙࡅЦMǢۍ੬ɲЉ̺Lπ׺૎הӖƺʠĉ۵խئ́ײȾ়ѷ੽؁ٕĊ΍uţɺǪ϶૱țˋաЋҫۭ ɓυؠȧǺصҿࡗهǰҳN'],
                    'encodeOffsets': [[
                            68116,
                            38260
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'VEN',
                'properties': { 'name': 'Venezuela' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@yȣӱĭ˜ϡYѭυӥ͆ڙδÆȌ؈ʻ̒§َਸ਼΀řІ̎ˆ̞ןל_մҵ˧ݮQ࣌ĔӖϕٞĻҼʾXɄਨ¼৖\\܉ʛ˼Їڦ×ِЯƆڧѬn͢ȣڕӱó̫˾̷ȽƽԫƉjϱɫɱّ֪Őʁ̭͍ऱ̽׿Žʏȣڛɀثņƿýϔɑ֝ŜՉ܆ï°ǭ׷ʅĭΣΉƏسȝǋʱٷÅҧѼʯ࠺ɟ̧̌ȄюмȊʅʠǛ֒à׼Ȉ˰ƲҎ̓Ơӏĩ؁®ͻęסܢӥńઉăȧ̊ȷêǬĴ̶áͺȃȂŅϮѡÈɸӮĺ׶ʔ̸͘ʌɈрդƖ'],
                    'encodeOffsets': [[
                            -73043,
                            12059
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'VNM',
                'properties': { 'name': 'Vietnam' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@૭ܗ۫ߍȁ׍٠ࢭ޺ળނԱԞګϪ།ŕ๓۫փ१եۇ۫਷ޱ̧ՠʀ֬دӌܬ͸ࢦÔσԚප٨ļ৖ț֖ƶࡀɃצٍאՋ݌ۥ঴৓Ԋʊ̠՞ɘ͙ܺਙPϕކӭڐҊȴڢIࠈĬܒ҄К̿ސƵƃӛАͿࡎɓ'],
                    'encodeOffsets': [[
                            110644,
                            22070
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'VUT',
                'properties': { 'name': 'Vanuatu' },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ˣō˭ςɤՆӗ'],
                        ['@@ƌڱɥŀǩ­ťɴi٢Дʵ']
                    ],
                    'encodeOffsets': [
                        [[
                                171874,
                                -16861
                            ]],
                        [[
                                171119,
                                -15292
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'PSE',
                'properties': { 'name': 'West Bank' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ԣŭʙЃŕɜɌŚɁĦǬ̤֔ś'],
                    'encodeOffsets': [[
                            36399,
                            33172
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'YEM',
                'properties': { 'name': 'Yemen' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@؉ɥǋύo˹࠷Οഇϻݩףυ±ʥºӭΑ՗ǉ۷©ɃµǿɛəÕŻɇеlˍœ׉¨ɓӬzҠƍʜǑتʋΊǚ¤đϨĸǊξςˌđΠɞЮΊɓɬúॺnƸċ߼č͐¨ɂ˫ϺƖ׼ࢦ޸Ϛᝒ͒ڀ൳˞ח'],
                    'encodeOffsets': [[
                            54384,
                            17051
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ZAF',
                'properties': { 'name': 'South Africa' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@ǏŧΣяɻћӇ׻ोࢁףԋًϣ࢛͙ѓ«ŇɷԛŰеǅ࣫ǊԙĹΏ¬ࡿͩܓƃԱͅϡoΣ̚˳fαϒśŏɦLӰ˙֞˔ƴs٤ս޼х܈AF׽તДдͪɯƘΫϘÓՈǃҌÖݤіB᷌ɨűӾߙûԟȈ̏׼ĒрϒЊʨȶДЦȚΠķВɽۂ£՞ȜĐʾƨДҚäʨ͂˪֔ݮغஒؤ΂UОƛ˲Ķ҂ċД஁ɔׯƫऩî̟чƶʏÑāʓɯ̿T̃ԆҕӮĜǢώْQȿؑıۥɑϛֵщ',
                        '@@νʶϻǟҕ҃͡Տـ٧̜ČƺˎҴƀƜ˜ʴФ̅ʪ'
                    ],
                    'encodeOffsets': [
                        [
                            32278,
                            -29959
                        ],
                        [
                            29674,
                            -29650
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': 'ZMB',
                'properties': { 'name': 'Zambia' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ІϏɊ܋ƝɩǙڻǈۡ˃̇ʭޭѶɓᢇۗĂׯٍřӍͯĹ̛̅ßܵۓҭխ˳o˗ĬऱĠƯÚOêͧȎկ¶ۋȑչԾ֣یᦶშYí̂Ű̀ƧЀĪТėʺ̂q¶ʽϾrՖûˬϡڨŝԤˆȌѯ٠ş̴ΧΈҥ٠Që࣠ɱƳח͞ɧƬļࡈƬসȉψʈ՚ɤĶ଀ƚͦđΘɇͰƗՖƗӊʧ'],
                    'encodeOffsets': [[
                            33546,
                            -9452
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': 'ZWE',
                'properties': { 'name': 'Zimbabwe' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ҁČ˱ĵНƜ΁VՙϞٯźʙՒC̒έĞ्ई˃ӢǛƮ͓ڤलğ˘ī˴pҮծܶ۔̜àĺ̆ӎͰَŚÆ̻۬hϴǯǺȻАÓѦˑF੟Ǐ׋عƊʝħӵŵùɛ؅ࢫ॓'],
                    'encodeOffsets': [[
                            31941,
                            -22785
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/xiang_gang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [{
                'type': 'Feature',
                'id': '8100',
                'properties': {
                    'name': '香港',
                    'cp': [
                        114.2784,
                        22.3057
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@}ScTʟ@cWuJÁ]l¦RLj¼BĄà H@TOHCTDDDHDNAT@PEHDDNJLX@BABALHFF@DKHADBBLDHHFBLEJB@GDBBFBADDB@@KFAFBBJJA@BB@@FFDDADFF@FADDDBJC@AFBD@@DDD@DAA@D@DB@DHHBFJBBFEHDFAN@DGDC@DLCBDDCFDlAFBFCBEF@BC@GDAB@FD@DZJX´HĐMja@Ý`p_PCZ@lLnRGSDMFK|a\\Y}­§Mën'],
                    'encodeOffsets': [[
                            117078,
                            22678
                        ]]
                }
            }],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/xin_jiang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '6528',
                'properties': {
                    'name': '巴音郭楞蒙古自治州',
                    'cp': [
                        88.1653,
                        39.6002
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@ÈÒĊanwŎVȮ¦ͪŃĢÜōȂçČéƐżLɆóĊĊaʊŁ±¯²Um»ˌmÈ»VʠţWÑÅ¯ǓéôƑƒğÆīŎī@Ƿwô˺LÞ¯ƨVǪÑƒĢȘV°wĢôk°¯ƒ»΀@Ȃ»ĸǔ@΀͔ôôLɆó̐ÝɜLɲōͪƨóŤK@ī@IU܃ÛmȻţǩÝ˹ÛǉťǓǫō@Ɲ²¯VçōKͿŁΗÇţ»ƽɅƑLÓŏÅÅɱV@ÝĊU¯ÑĊĭÞLÞŎJ±̃XȣˌōlUÈ¯ŎKÆƅ°XÑÜ±nŗġV¯óaUƧUōŁÑ±çɲ¥lĉkğ°k¥nğţL¯ÝÝUƽĬ΁lķ°@ōXÿÝ¯V»ŹLʉÞɱŤĉó°ÝJ¦ÝKÝ£ţÜÈĉ@xǩUċƑ@ky͓¹`U²ĉVġ»ğa¯¥ť@ĉó@ŻÛÛJw¯nó¯ġWƽʩķÝɛwĉĕÝ¼ȭÞķō@ó£Å΀Ƒ¯ôȯÞ¯ȰÆōèĉXÇ¼ó@ÝnºĸÞVƜĸȚUʶõˀĵĖɱŎÝĖVࢰӒѢ°˘nϚVˌÈmɼĵŦW¤öʊõʔ@°ÈXVènŎȁb¯ǫĉ±Èğ`ġwōÔğ»mVVÝ¥ó@ĸķô@bXĶmV²²`Þ_ɴbͪÈ°ÞWĸÈŌmÞkɲÈUÆ»n¼ǬVķĸźô¯°n¦ɄÇÈ'],
                    'encodeOffsets': [[
                            86986,
                            44534
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6532',
                'properties': {
                    'name': '和田地区',
                    'cp': [
                        81.167,
                        36.9855
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƨ¥èź٨ΘƑᩄbUࢯÞĕɲōĶĕöʿVʵķșUƛÝķm¹Þô@È»ĊWŎçÅ°ȯȰÝ°óƒÆͿĉ»̽çnmɱĵƧºóUƽ@±wóL¯°̻L±Æ¯Vƴķb¯VÇ¥ğ²Ǖbk¥ÇKlÅɱġ@ÑóK@ÇaÝXğţxĉČǫķê¯K@ÑaŹƑK¼¯VóaónġwóÞéUġbóĉğÇl¹aUóğKWVÅ¯nÇŋƑķnʇ»óxĉwçÇ°Åw°ċXób±kÈÇJm²ţx@ÒÝŦÇºnó¼n°ÇbUÒ±¼XĸĠłƽXmwĉºzÈÜmnxmx²ĖmÒbnƧêUºĊêÆVóĖóUĉ¼ÅĬƑ°ɆƆŻŚlłÞL¼nĠ¼@ÞÞź@ŎÞ°VɄɴжϼِ͈Ŏ'],
                    'encodeOffsets': [[
                            81293,
                            39764
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6522',
                'properties': {
                    'name': '哈密地区',
                    'cp': [
                        93.7793,
                        42.9236
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WnŐÆĶLĢ¦ţºźlxÅĸƽŚɄĮè@ô²ÞUĔƐńV°¯ĸX¦Ɛm̐bƒ»Ɇa΀ĢƐLˤȘÑnІǉĸÿn¯ĶaŎ¯ĢĕȘ¯°΂la¯¥ǕǔwˤӱlťО̻nŻmɃĕċţUw°WUóƨÅţķ°ýV±óÅǓéʉ¯ƽŁéōǖȁÝƏůǕw˹ǫȗǓƧǕVýé@ĬţLƧôͩɱŎɛK̏ÞɅôóK@²@°ōŘ¼lŦ¯ŰóƜÛlV¼ķ¼°kȰŰĠǬŚÝŎmĖ`@ÇÜn'],
                    'encodeOffsets': [[
                            93387,
                            44539
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6529',
                'properties': {
                    'name': '阿克苏地区',
                    'cp': [
                        82.9797,
                        41.0229
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@VÆxˌŎÞŎ°nȂÒ°²VĊ¯VğƾˍǬƨÞÞKÈÞĊVźôɆÞĢèŌôWČ²ŤVÞĸʶbl¯ôn_VÆĸlmÞnVź_ĸ¼ȮmǖéĸW°°ĸJkʠ¼Æw°¤ÈlxɆzČºĶI²ÆǔU°ô@Þ¦UnUĠ¼ŎÓĢxĠ_²ÇĊǬ°ȂamōçUÇW@¯öʓõʉX£ĶťnɻÇUˋmϙ¯˗ӑѡᩃaΗƒɜ°xWƴUxɃÒˣ¤ɅwğʉōóÝŹ±°ȗ@¯Æƒ²¼',
                        '@@ōгwȁ¥Ƨ°ŹÑķV¼ÞêĊ»lĵm¦ÅW@ĀôÈźaɜxÈbÞÆĶIОŘnIÇŃÛÝĊÑĠƏ'
                    ],
                    'encodeOffsets': [
                        [
                            80022,
                            41294
                        ],
                        [
                            83914,
                            41474
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6543',
                'properties': {
                    'name': '阿勒泰地区',
                    'cp': [
                        88.2971,
                        47.0929
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ɲˣĊIÈ¥ÅU±Ċýkō°ĉƽó»ĶƽXóʵʵȯƑÅȁɅ¯ĉ@ÇሗK֛@@ˤV֜ʵрƒǬVĸƑŎ@ƆϯÑóķ@ʇ»ķ¦έmlÈĸĊX¼WźÛÞÝѸĢČþĀĊôάVö¼ĊUƨ°°èŎČUÜÆóôVôô²êȘlˌç°`n²ǬĊaÛ°±kğmm»@°ÝɆÛÅÇVaÝVm͔ğôÝÈb@n¯ÜUĢÑĊ@źīżWŤÈǖWôŁÆI²ÓƨL@ĊXmmÑÆ»ȰÑkĶō@ý°m¯'],
                    'encodeOffsets': [[
                            92656,
                            48460
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6531',
                'properties': {
                    'name': '喀什地区',
                    'cp': [
                        77.168,
                        37.8534
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@Č@°ĠôÓô@Ŏĉ@Ƴĸ@Ť£ĢlVôWVóřXĉŤêÞ@ƐÒĢÑlèÈV@ĠIk°ÆŘ@ÈÈĀ@ǶťÒğ@@ÒĉlŻ_@ƧĖÅĬōÆ@bźÞnƒlVÝĬWÆ¼ʇÝÅ@ÇÅÈwWóĉ±ğzĬČƨÆÝIĉÝ¯bÇÑĉ¯ʈV°xUŰĊ¤ƪ_ôÓɚI@lȚXȮŎlɴȘ՘¦ɲÆʈ_ɴźôÞʊŎĠɆxˤ£ɄÑVwXƳ¯wɛŹ٧çƧ¦ōُ͇еϻɃɳUÝ¯@ōÝŹ@Ý»mğ»ÝKkŁżřɅƅƒ¯ÆīĊ»ôVôĕÅUĉéV¹ƨémanÑ±ĕnwmwnÇÛyĉ¹ŹlŏkĵèķmōÞġKñÔċKÅèĉzômxȗÿƿI@þÅČÝKÝ°@¼ÈVº@ÅĢÆUċłnÝÆǕČĵJm£ÝJ¦@ĊxV°ƏLċ¼ǩ@m@ÅĢómÇÆğ¹ÇÆĖÞKxwô¦ÆÑÆL²ÆƾU±ŚÅŻĖ@ĬŤÈñ@ǔÇxÈÇƒ',
                        '@@VÇţ°ğUĠ¯mk¯ó¥ķIġÿƏbĉa±ÒĸĀlKU_m»nwm@ÈŤ¦ĉbÞ°±Þżł̦°ĢŁVé'
                    ],
                    'encodeOffsets': [
                        [
                            76624,
                            39196
                        ],
                        [
                            81507,
                            40877
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6542',
                'properties': {
                    'name': '塔城地区',
                    'cp': [
                        86.6272,
                        45.8514
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        '@@ήnĸ¥ʈ¼ĸ@ôϰÒ@ƅƒōUķƑǫʶпU֛܃LګK@΋ĸ@Æ£ÞġÅĠċLVÝ»@Å»Ýnm¯»nŻĊ@nķŃ@¯ómóÛÝǟ¯aÝóȭ¥ōUmxĉbÇÑ@bUº¯X¯ÆƧbVÒĉnǕw¯°ƑVÇ@kx±UɱnÅK¯ƒĠǠU°ɜL@°xnĬĀŋŎÇLğϱÞέƜkôÅĀǕłĸĊŤUŰĢ°¦ȂϰÜɨ°x@°żǠÆƈČVĠ»ČL°ÇbĊÑ̐óÞlĶwÞɆVÞwǬxǪţÈ¼ÜLŐĶˢ@',
                        '@@óKĵĀV͈ĉłƾǊÆŤzXl°ÆL²¼źôÈĢǔ¦lô°ɜÞʊĠğÅm»ʵƳƑʝȗīV¥¯ĉ°Ñ@ŃÅI»ĉmğnaċƨbVğwġ¯@UōaĉÝJğÑÆŎkŎÞĀlź¦'
                    ],
                    'encodeOffsets': [
                        [
                            87593,
                            48184
                        ],
                        [
                            86884,
                            45760
                        ]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6523',
                'properties': {
                    'name': '昌吉回族自治州',
                    'cp': [
                        89.6814,
                        44.4507
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@መL@È°ĊȂɆƒÆĊ£ťôWÓɆbĢÅŎÆ¦ČÑW¥°ķU¯ƏŃVē±Ý@óçĭɃƾřÆķkwŹŤ¹ġ¥ĵKŏÅXmˍщwǓ¤Ƒ@wóōVķ£ɱġôÛa±ÒȁóèţIVƽ¼k¤ó¹ġJmx»ÝU²@ÅÆĸǫŎĊmŎǬ՘'],
                        ['@@Þô°bÞǠôÜôn@°ĸńǶkł¼UÞKğČÆÝĢÅ¤ķ@@ΌڬL܄K@ˣȂ˭lĉÅW¥ĵVÆý@ŃÞēUŃȗƅ@ŹƩǕĉ»k»ÇVğóřXŻKƏċêȁèÛŎġͩń']
                    ],
                    'encodeOffsets': [
                        [[
                                90113,
                                46080
                            ]],
                        [[
                                87638,
                                44579
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6530',
                'properties': {
                    'name': '克孜勒苏柯尔克孜自治州',
                    'cp': [
                        74.6301,
                        39.5233
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ˎǫĠƽ°UUĉ¯±ȁÑm¯ÝōˋōwUÅ±»ÅƑ°Ș@²¯ɳʇ`ɱÅ¥՗ɳȗōkȭșW@kəJóÔƩ`ĉ£Vů¯wU°ʇĊÈÒ°aĊÞÞJÅċƧīĠyĊ²XôÇxÈÆÆ@ÞʈÅ»XÞīUƑkmŹÝ@aŎÅÆīƨĕ@ż`Ċk@ÑĠ@ŦÑ@ǵÇÿ@ÇÅŗl¯ğJ@ÇUkçġÒƏÑÝ@ţéWĊôŚUóXUġkţ¤ķ@@ƴōĊó@óÔğ¯ċ@@Ò¤kôˣŰ͓k»KX¯ċwƧôğɐÒôIVÆ¯UķǬķn¼ôb°ÒȰVVÈÞ°ĸó¤V¼°V°²êlĢÒUƨ¦ôȰƴĊVV¼ǖIċĊÞɜénČW˸ǸařÈw±īçĸ¤ĊôwĸUĢ¦éǖĬĀô¼lÞkÒ°x°ƆÞxÆV²ǔ»b°wÞȘ¥°nŎV@°ʠèŰȂb'],
                    'encodeOffsets': [[
                            80269,
                            42396
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6521',
                'properties': {
                    'name': '吐鲁番地区',
                    'cp': [
                        89.6375,
                        42.4127
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ôKĉǪa²¼lÜô@ʠê°ĬôȂ²ÑÜbĢóɲĸ¤ŎUô@xƒǔ£ъxˎmÈÛ@_nĕÞōřǫğůlȯ¯ĸ»U»Ükôƛ°ůkť»Ŏŗ@¯@±͓óͿǓ@ķȁ¼Ϳ@Ƒ¼¯°ólġ¯xȗUġƑǩÒƧUÝ°˹Kóx@ǸōĬÅĬƑĠóƒǔêÆ°XÒʟŤUÇ¼ˋnn¼±V²°ȂUŌÝbʟǔɅô@żǬaҎÈ'],
                    'encodeOffsets': [[
                            90248,
                            44371
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6540',
                'properties': {
                    'name': '伊犁哈萨克自治州',
                    'cp': [
                        82.5513,
                        43.5498
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ĉÆŘȁ̐mÞ¯ĀX°±¼@ƾ¯ƴ°ŎÝþŋ¦WÜÞbȂĉźUÇmwVUȂóô@ȰÝ΀nÆJnƾʠŌLČóǪ¯¥ǔaǖŌaôÝĢLxÆLɲm²VlwÈ@Uƒ°¯ǖxĊmUÑƨa°Å°WV¹aÇɃÈm¥°¯ŹóĸķǫUm»Å¼ÇVɱlÝŋnķÇÝX¯ͩÇɳaÝ`±_U±ĵnWa@ĸóķ¯ǓV±ÅĵJċ¹ɅykwÇ¯£Åxʟ»lķI¯X¯ķêǕȭnķ»Ź`±kÞ@Ýô@Þ°xŤŎIƨÆUxō¯²ǔĬǬlUŚ'],
                        ['@@ÞĀlź¦¯ĸŤKÞċƨbVğwġ¯@ţƽJ']
                    ],
                    'encodeOffsets': [
                        [[
                                82722,
                                44337
                            ]],
                        [[
                                86817,
                                45456
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '6527',
                'properties': {
                    'name': '博尔塔拉蒙古自治州',
                    'cp': [
                        81.8481,
                        44.6979
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ήƛϲÝĠÈKŌōÿmīw@¯ɛKV¯ğǟ°ƑwġKóÞŋbǕǓb¦ǩ°ċôŋKʟƽmÅImͿȯÞó@ȁôUVnxÈŹVȁĊÝabŻ£¯°lóxȂŤĸkĊÞyĊêĊmĢxVƨÈĠXΘÆĠÔźɆţ°LXƾŤŤb'],
                    'encodeOffsets': [[
                            84555,
                            46311
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6501',
                'properties': {
                    'name': '乌鲁木齐市',
                    'cp': [
                        87.9236,
                        43.5883
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WôŚUĠÈl¼Ċ¼ƪǖ@źȘƆ@ýlÜXVŘÞ¦V¼kĖóÒèkĊȁˮ֜@ǫ՗nōĉǬōķÆÅ@±ÞV¼nwĢIôºl£ƾ»UŤJôçó¯īʟéó@kÛ±»ǩbĊóLҍÇǫb@ŻɆóʠǓaŋÞȁVʉłĉbĉɅô'],
                    'encodeOffsets': [[
                            88887,
                            44146
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '6502',
                'properties': {
                    'name': '克拉玛依市',
                    'cp': [
                        85.2869,
                        45.5054
                    ],
                    'childNum': 2
                },
                'geometry': {
                    'type': 'MultiPolygon',
                    'coordinates': [
                        ['@@ɜÞʊĊýVaÅm»ʵƳƑʝȗīV¥¯ĉ°Ñ@ŃÅI»ĉmğnaÝţL°ķóKĵĀV͈ĉłƾǊÆŤzXl°ÆL²¼źôÈĢǔ¦lô°'],
                        ['@@ƾIŤ@UUwōaĉÝJğÑÆŎkŎ']
                    ],
                    'encodeOffsets': [
                        [[
                                87424,
                                47245
                            ]],
                        [[
                                86817,
                                45456
                            ]]
                    ]
                }
            },
            {
                'type': 'Feature',
                'id': '659002',
                'properties': {
                    'name': '阿拉尔市',
                    'cp': [
                        81.2769,
                        40.6549
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nIÇŃÛÝĊÑĠƏōгwȁ¥Ƨ°ŹÑķV¼ÞêĊ»lĵm¦ÅW@ĀôÈźaɜxÈbÞÆĶIОŘ'],
                    'encodeOffsets': [[
                            83824,
                            41929
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '659003',
                'properties': {
                    'name': '图木舒克市',
                    'cp': [
                        79.1345,
                        39.8749
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VéVÇţ°ğUĠ¯mk¯ó¥ķIġÿƏbĉa±ÒĸĀlKU_m»nwm@ÈŤ¦ĉbÞ°±Þżł̦°ĢŁ'],
                    'encodeOffsets': [[
                            81496,
                            40962
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '659004',
                'properties': {
                    'name': '五家渠市',
                    'cp': [
                        87.5391,
                        44.3024
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@çôÑlĕU»¥ÝUŗWkÛ@þVńÝĔ@ńÅþĶUX¦Æ'],
                    'encodeOffsets': [[
                            89674,
                            45636
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '659001',
                'properties': {
                    'name': '石河子市',
                    'cp': [
                        86.0229,
                        44.2914
                    ],
                    'childNum': 1
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lŁǵmĉ@mż¼n°ÞmÆ¼@'],
                    'encodeOffsets': [[
                            88178,
                            45529
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/xi_zang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '5424',
                'properties': {
                    'name': '那曲地区',
                    'cp': [
                        88.1982,
                        33.3215
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ƨʔĸbÜºÞwnxźbÞ°ô@ĶĸIÈ¼ĊJŎÈôUÝƒ¤ǔLÞŎ@ĢȘblôLÇźçÈ¤ôL¥ÞIÞ¯ĶxʊťƨƿÑĉXVķŦ¯ȂKÇǕÑ¯IU£¯Óƿ£VĕÅÞÿÆwƑ£ǖxÞĕ±ÇÝaUÑÈU¯UōÈÝwWŁĵ±ÝóĢÿ°IÞ±mÅĢ¯mÿ¥°UnÑŤĢĕĶwǬŻͪwŎ¼źÇĢĠĕˎŁ°óƨ¼Èam@¥°wǔǖ°ƨÇŤġƨŎŃôbÈÛŎĊ°@Ġw²ÑÞJÆÆb²°êĊUÞlÈ²VÈKĊÒĸĉ»ÅôťUÅÇk¯@ÇÑklÇÅlĢVÑó@°@ÛĸV¯ÇĊn¯Uĕƽ¯m¯bÈ@Ò°Ĭbĵ¼kxķýÇJk£ÝaUÑÅóĶǟkÓʉnĉÝ¼Ƒó»Þmn£mČ¯@ȮÿV¯ĸk@Ýów»ğġ±ǓLōV¼Əèķĉè±b@ÒţUÑóakl£Ó@¯L@ÇlUóȁ¯aġÈÅĕÝLķ¯Ė¯@WĬxÒÈnW°ţôU²ǓÓġ²V°¯ôǔÝLċk»Ý»Ý¯ÞVwÛÝÇōͩÈĉċ»ĉm¯£W¥ţKkóġƏW@¯±kōÈb@ÒÇaÆ¯akóÛÇ¦Ýa¯Ýĉ@Ç»ÛmǓxķƛ¯lVĀÅÞġbÇJUÅVĖƑWzō»ōWn@è¯ÞóVkwƩnkźÇÞÒÞ¯ýğÇUxÆÈnè±bĉÝ»ÈŃwwÞ@m»ÈV@ýÇ°ķxaÝ¯Xċ¥ÈóW@ôkxlnxVÈóĊkŤġ¼@°¯ŰƑL̻Ű±ŎÝVÞVÇÞÅÇakƞ@èğŎĸżƾ°ÒLÞôĠKȰĖźVÈÒĠ¤VôUÈþťL@ôǬÞlÜÈnÇÒUŚ@ĊƨW°°X@ČÇþƴĉÒķ¦@ĢôWĀôłUÞĢǬź°¼@ôV°bUÆnzm¤ƽĸÈ'],
                    'encodeOffsets': [[
                            88133,
                            36721
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5425',
                'properties': {
                    'name': '阿里地区',
                    'cp': [
                        82.3645,
                        32.7667
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Çƾķn£myVÅaU¯ó@¯»ŹġǫVÝóŁXÿġó@ĸ¥ĊÑƳÈý@ċW¯X¯ĉƧ@VřÈÑÇmkÛǫÝ@óŦKÇýVUó£ğÇÑŹUȯĕğLÝóK¯ÑƽķŻĠō@çlƝÈbÆÈÝUÝÞU²ō̼ůƒK°ů@¯UK±ĊƧbōÇmçÈġóÅóbźó¥kīÆ¯ólçKôĵUÅVŃķ¥nÅŏm¯¹Å»@ÑÇóxÝkʇȤU¤ķb@ƒ¯ĊÇx¯ĸĉKm°Āk¦lKnĬȀƾÛ¦WÆÅmǊĉ°ōUţ¤UŎ°ŎKÞłÆǓ¦Þř¯bmUÝl¯Umğl¯£șwÅǫaÝnĉĶk@¯Kō»ĉnaÞ»ťnkmlĸ¥UÅŻkÑťĉVôó°LôīĠUÿĉǕÅz±K¤²ō¤¯Ė¯UÝ¥VĵóÈťÝwķÈÑk¤óWýĵĕVĠVóǓķ°k±VU±ţ¦UǟÝÅJVÑ¥XUċUÅlÛƆǕÆȗƆ¯wŏÞÅ@ĉlÝóÒnUôÅlxólÝôÛ±LÛôÝL@ġ¯X¯ÇUÅ¼óaó¤¼XÒġŎóLk¦ôÅ¼ĸĠ¼KġƆô¦ÆƑÔĉĶ¯ImÒ°¦n°¯ÞlÝČnƒÒKĠÞĕklýƾťôIĖŤÒnƜm¼¯lnżóÞ@Ůó¦ôƽĖċŚn°Ý°ôÈUƜblÞó@ǖô°UÈƆ°XþôôlѢ²Ėm¦°@¤XĊblÜzkºƒĖmXŎWVóÞn°lĠxȚa°»żLźb@Æ°XĠÝȚxĊĕŤaȚ°È@@èŤ¦Ü¼WÞkÈ@V°lŤkŎ±²¦ƐUǉ°aÈÑŎbĢŎbÆ¥ÞIȘlôVÈUbkɲĶnmnXb̼òƾĖŎ@ĢȂÑôÓĠĖʊĊÔ'],
                    'encodeOffsets': [[
                            88133,
                            36721
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5423',
                'properties': {
                    'name': '日喀则地区',
                    'cp': [
                        86.2427,
                        29.5093
                    ],
                    'childNum': 18
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ĶĖXþôl£ÒĸÇÞxÇŦôUĶÞ¦°V°ĕŎ£±£²LÆyĊǖĀğVóĬ¯KóôUĊŦlÒżVÆķ¦klnŦmÝ¼bĊmŎ¼L@°lĊĵÞmǬbÆȚx°¤Ġkn°VÞkVn°aŚÝǔ¥ÅÝŁōL¯ōVŤ£ŎVĊ¯nǉÆXÅÜ¥ǿƽmīLkl¥ÿn¯ĊL°ķÈw°ĉ@ƑĸaV£ʈȣÞlôwÈ@Ò¼Æ°ºŐnmÆĸ¦UńÆVóĶLèôkÅ°lĬ¦ŹôôaÆôÇĢnèŎÈƨaĉ²VLĢ»lţôĉUÇwkmlw@óôXÇČ¦°WÞbwĸÈ¯@þÇUn¼Ý@xxÇńÞ¼Ċ²amçÅÇVwĠÈþ°ÝÑÈÝlŹƪmlxôU°Ý@çmXŎŎ¼yƒXĕÆUVÈIĢaÆÝUÿ°kĸƜǔwnÜÈ¼Ċ@Þ°ÞbÈ¥Üôl°bÅÈb@ÑaÇ¯UU¯Vġ»¯aV¯Ç°ÅmnÑŤçǬVǬ±ĉ¯¥Vĕ¯Ýk£ōw@±ġÛ°ÇVÑ@Ûa@ČLƳÇa¯¤ÝIĵ¼U¥ƿōķÅţŻókÝóĕ¥¯U»Æ£X¯ġŃÛkÝ°V°ó¼¯èWôÞĖȎkĀƧĀówm¥¯JÅ¹ÝJÝōVVÅaÝƑ@ğŭÇ¯_ĵVnxÅónĵxÇĖĉVÝÈğVÒó¯±Żĉ£ķÆÅLǈĉýţÛ¯VnV¤ÝÈ@°ÅÞÝ¤ŰğŁm¦ÝxóK¥ɱÈUĠôêVôÛ¼ÇWÝçĵaō¦óĖƧlÇĢƑnŎÇV¼¼ºÛ@m¦ƽĉmm¯ÝKÛç¯bŏłĬb¼ÅLmxť°ÅUÝXkÝmĉ¦W¯KÒknÝaVÝè¯KɅńÝKnÞ¯¼'],
                    'encodeOffsets': [[
                            84117,
                            30927
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5426',
                'properties': {
                    'name': '林芝地区',
                    'cp': [
                        95.4602,
                        29.1138
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VÈłVôÈk@°K@Ôk¤lôbVÒŤ@Ñ²açĸĊƐçU»ŎǔKĢ²Ġ¼ôx@ÞlƨĬUl¯ÈLVÞJ°ÜnʊwÜbXêVÞ¯°anaU°wÆ¼ɴÑWÑ°mÈýÈam¥Þ£Ť@¥ôblÞĢź¥ôxÈÅmÝĕÅV»ĉōŤōnó»ÈīķIUĠÑ°ġĸLÞ¯VÒÆ@Āb¼WôÈ@V¼ôóŤKÈÑU»wVǫżnWÒÈx¼lŦ£ĊōŤx²¯@ÆU¯çÆ@¤°£é°k°lůÈó@¯ŤÇÈĉkkÿó¥ÝXķÑÜ@ÒóŚÝ¯°ĉówÇ±¦ÅJUÒĉĀķw¯°mĖ¯±akxÝÅn»lÑK@¯lU¯UVÑ¯óĊ¯mōğVǓƅÞWÝÈÛ@ƿô¯ÜġzÅþ¯ólmôʇġĊÅUͿřŏȁˋŁóÇˡōƧÇbw°Ķôk¦ÒnUþġÒÔkǔķèó@²@ŘōńĵyzġaÝ¤ÅI¤Ƀť¦ğÑ¯¤ķbó¯ó±U²°¤ČÜVnÈÆŚŎ°ôĢþÆzèVĀÇĀÇXŹÑ¯¤ówċķk¦łUÒġzÇ@ÆÝx@²Þ@Æ¤Uô¦U°xU'],
                    'encodeOffsets': [[
                            94737,
                            30809
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5421',
                'properties': {
                    'name': '昌都地区',
                    'cp': [
                        97.0203,
                        30.7068
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@VĖm°ĉÈU°ķÜ¯@@ôUÒġkÆkÈlÒ@Èl°ÈVÆóŦÆ¼aÅĢɄwnōw@¥Ŏ¦°ŹÞmV°wnÿwwÝw@¯mÞŗ°wĠĸkÞğlĔ²¦°@ĕĸwVóal@nĢÇĊn°@¦źUXçǔůĸVÆKÈÝĠ²ÅĔô@lÈ_mzǖlaU¼ôwV°¯¦ĬÈal@ČÇ¼nIxô»ɜ@ƨ¥ɆŁŃǪȁkƛƨȍʊȡóĭ@ÈÇVůÞĸƅmēƨťÅÈʉVǵ°ġVŭÅɧ°ÿnɛ£mķ²ŃóÑUĉ°mÇ»¯@mxUĀ¯èţ°ȁÝçġU¯ÆÇţÈ@°ÇôŰ¯k¯lê¯¤£Å@èV°Å@±°ţwĉŎť¤k»ÇwXÑŻmUǬxV¼ÇÒţLóôU»Ç@Xó»a@ÿÅUÑÝ°ķK¯ĢğÒVĸJÇĬ¼môţŎĊŎU¼ÆĖnÞÇÆówŹ¦ġkÝóa¦ţ@Ý¤n¦ÇbÇþ¯nXÒɳÒÅ»¯xVmbb¯Ý°UWéÛaxʉÛm¯ÝIUÇKk°VƧīķU°ȭĀ@ċ°nm¤Ýnô¼ƒÞ»ĊʊmlÔĵǠÆôVÒÞbl¤ÈIĸþlw»Ķa¯ī@ÑÇ°anƾ°'],
                    'encodeOffsets': [[
                            97302,
                            31917
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5422',
                'properties': {
                    'name': '山南地区',
                    'cp': [
                        92.2083,
                        28.3392
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°ÞUĖ°¦²ĊôÇÜLǖĀɜȘŰÞLĸźêÞ@UÜUŤ°ɞ¯Ü°WŦĀmŎ¦ĢyVÑŁl¥Čĸôx°£źÒWÈÿÈUÿçÅyýóġō¯řÅmÇÛUċ¯£V±²°ôôĸa°£ĠÒŦ¥Ʉ£ÆJÞ£ĢbyĶzŎŃ@ŗ±ô@ĸçlǓÓĢÑVýmÑl¥ĵó¯̻̥ƛǫÝһÇƧĉyţ¼ҍēVĶĉŎ°ĸmÞVÝĸÒÛaċóŹĖèÈÈl¼k¤ÝX@`Þŏ¼Æō¼ÇçĉKUÝÝ£ğ¤@¦ġl¯Òġĉ¯ómóxÝÞğVƴċK@b@ÜUÒ¯ÈĢÜ@²xŎl¤'],
                    'encodeOffsets': [[
                            92363,
                            29672
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5401',
                'properties': {
                    'name': '拉萨市',
                    'cp': [
                        91.1865,
                        30.1465
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ŏ²l@°XĢƐlôŤLX¦°¤ĊnČ¼ÇĊŎͪÞÈÜxU°ÝÞÞ¼¼lČÞKǓ°óU¯Ģ±ǔÔV±ŤóX¯ÇmÑwXī°@°ĕĸÞKÆĖĢÇ°bȂÇŁUV¯wVó¥VÅ£Ý@@±ÞwÅÈ@¥nōťÿ¯XÛɝ°ţ¯ÛVVÝ@ŹéķÝKȗůɛǕÿÛKóÈǫǫUţèmÒn¯Æ°ÈU°b¼UĢV°°V'],
                    'encodeOffsets': [[
                            92059,
                            30696
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/yun_nan_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '5308',
                'properties': {
                    'name': '普洱市',
                    'cp': [
                        100.7446,
                        23.4229
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Uô²a@²²Ķ¥V°Ķ²bl¤kVxl@°Ś²@y@ô¦¯@xxVxUVbVÜm¼ŎĢmºXXWÆ@ĀmmXU°ÅÒm¼Þx°w@°XêĠ°»nV°Ul@k@V±ôī@£ČŃÆ£KÞý@¥k@ya@nWVUVwm£Jknm@wmknXX¥mUUlUnb¯°nkVInlIUw°nmk@@mlanXlanmk@wVWUw_@éĠanmUaÜ£mX¥¯@@óUmÝ¯¯ÞÝlKnxô£»»ĠJ°aVUÝÿV¥ÛbI@wmón¯yÛL@WkÅmÈ`IWa¯K@¯mUnmaXmbmak¯ĢÒÝm¯mV¯KÇb¯KÛWWX@aVknċLUWVkXóW@ka@ób¯Uwmb¥UUlaU¥U£maķKXkmÝ@kwmÑ¯k±ċbUUVakaġ¦kL@`a¯xmÅLUW@ċnÅUV°LkL@b°°@¤²nôôkl°kèÒÈzV¤ÈWôônV@¦@¼Ux'],
                    'encodeOffsets': [[
                            101903,
                            23637
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5325',
                'properties': {
                    'name': '红河哈尼族彝族自治州',
                    'cp': [
                        103.0408,
                        23.6041
                    ],
                    'childNum': 13
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@°°nÞôV@°@¦WnÛ¤Vbmnğb@ê`VxUX@xÆÞUnnWÞĸĢÈ@Çè@zÛÜWÅêl²KnV¯ĖĊx@bk@@°JÆ£Èblnnm°nlUkVUUwVmKnnVÞxVLX¥laX@@xl@VzÈVmk@b°ÈĸmV¦`WXbUbbX¼°x@aVVkn@lþnXUlVxŤÅyIUkaIŎĊ@lXx@bz@ô¥_V@ln@ôy@al_l`nmÈ»@kmXwWKU¯»aÅ@wmUÝKUaUUwW@w²»@kÆV£mm£VKkÑV@@»nw¥@kÆnllIVlnLVakalknJWmnaUaVÑVVÞn¥m@¯Uÿl@VçaXaV¯UyVLVk@nJlXLlkxlbla²Òl@nVJVkxKlkUaVķÝÑU@Åm¯@±Uó°ğńķĠmUÑ@Ç¯¯Å¼@nml@°¯¯`@w£@¯Çk@»nmċ¯U»I¯LÇĶÛn@bó°Uwm¯UmÇ¯aI@ykIVU¯bIğ¼¼ó¤mwkLÝÞ'],
                    'encodeOffsets': [[
                            104243,
                            23429
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5326',
                'properties': {
                    'name': '文山壮族苗族自治州',
                    'cp': [
                        104.8865,
                        23.5712
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@wô@²¯maUmôUÆx@XbÞInlVUVwJVaUK°¥xmÞXnlKlnna°@ĊČÆwUmnkl@°£nyn@VV@Vak@@kÞÝbmx°Vnw°klÞInĖÞVlKl@Xa°KlVU@JnxU@ÈĢbUKlm@ak_wanWUk°l»k@Wk@lwU_@UalóU¥ÇnkJW@mVXx±bK@nV±a@Åa£ÝK²WknamKknÇk¯aVV¯ĀUÒ¥I@mm¯¯xÅW@@`k@ó»UU¯lm£ÅWlĵw@mmwÅmWU@y±UxmwU¯U¥Ý¥¯£m@kÇVUV°VbklLwUlUImk@±ÑkbkalwkWKkmI@UlUKVzU°WbbUè@kVĀ°@nm¦ÝUUUÒVbmbXnmIkllbUbmKUkkJmkÅ@l¦mx@¼U@lÒULn¤nU¤Å@l±¼@xXxVVVbÞLVn@xÆb°¼V'],
                    'encodeOffsets': [[
                            106504,
                            25037
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5303',
                'properties': {
                    'name': '曲靖市',
                    'cp': [
                        103.9417,
                        25.7025
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@È¦lKÞĕUV¯Um¯ÇVUnVVUĉnĊÇƾLn°°ÈJÆw@lbÞa¦VXJ°¯W¯aÞJVkUa@lKnÅmWUk¯a¯»@m±@ÑkkbWWX_WÓU»_lkÑm@U»m@l@IWċn¯l@VanVUVUVwVxKÈVmUē@n@VÝÆLwVVwnVlmkUVÑÇ°ka@kÿÝaÞUl£ċĕX±±ĉa@UnVnalónk@wlUVmkÝJaW@ÅwóVVnnb±°@óxXLWxn@lÇ¼nmk_k`@bózm@kU@`¦ó@nW@ÜÅXWw@yb¦@ÒlnUb@xlÜk@²Ç@U¯bmy@kV@bb¦U`lLVx@bLl¼Þ¤@°VVÞU@WÞUbJ@nn@lnnmxUUUbK@ÇwklkUVWakn@lbU@@ULVxkKUn°¯Ò@¼km¦m@klȰ@lUl¦@Vl°wnnþĊUÆbUxbVĖU°annaVal@@b'],
                    'encodeOffsets': [[
                            106099,
                            27653
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5323',
                'properties': {
                    'name': '楚雄彝族自治州',
                    'cp': [
                        101.6016,
                        25.3619
                    ],
                    'childNum': 10
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@mÒXU`Wn@Xl±¦Uxnbl°knmKUxxVôUx°¼ôÒÈ°JlnÞKĠW°¦Vx²JVw_°¥@UV@@wnymknK¯I@²b°£V¥wUV¤nLkÆJÈwôô°l»Č¯ġVUU@@°ÝXl@U»°Å@U¯@w±¯VmUUlm@mÑnIVyUwmak£Vwm±@Çw@n@UxkwlÇnLmkÅ@±kka@kóJV¯Ç»U£lw¯Xalbl¥¯UX@aUaÈL@ÇVIVkaU¯mmakLWkUJ¯Umxn@kUx¯xmWÅīÝkkbŤbkxWmXwWk¯wKkLÅ¤ċń@¤óĬU²@@lk¯VmU¯¼@xV@k°l°kbU°nmVnU@°UVèÞÆbUÒÞnU¦V¼lô@Vl'],
                    'encodeOffsets': [[
                            103433,
                            26196
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5329',
                'properties': {
                    'name': '大理白族自治州',
                    'cp': [
                        99.9536,
                        25.6805
                    ],
                    'childNum': 12
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lbKVIUa@²m@bxôÒÜxXLmbnl@K°¼kUôxôlV¦nJUÆnm@xÆwbXÆôôLUVwôK@wlmaVw@WknmIUmlnJla@_@kÝmKUaÑm¯Xw°aUaVl»²JVbÆJkôĶĀ²VVkmbVwUówVwnLlmk¯maVw²¥Wk@XmV_WnÑUk@kó»UV¥ÝmVÑÅaÝUçV@¯VUmn¯mVlak¯l¯U@@wğWé¯@¯xÝw¯¯Jċa¯U¥mLU¤bÞȤbÇLWUwmIUVW¼kb`UVb¯L±ĊÛkÿÝKkwKţêUĉþÈV¯ÞVbU°KVk²ÝmImV@kmUkVxm¯KXÈķJU¦V°ULWxL@môb@bkx±LnVUVLnkÜWnwlLÅƒmW@kkJU_VWĊÞ'],
                    'encodeOffsets': [[
                            101408,
                            26770
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5309',
                'properties': {
                    'name': '临沧市',
                    'cp': [
                        99.613,
                        24.0546
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@xĢl`²X°Vx@x°Þ°KXağUÑWbnIl`X²°bxl°V@xVxk¦mbl@xXVÆzX¤Æk°kx@lźêlaX»VUnJVxXÈKaÝȣaV£nKV¦°Čb°I°n»ÆÑV¯nWn@ÿXÅWWn¹ġōn»ÛUaUVUww@w°ó¥@z±@ř¯@kUwlk£±aĵ¯Uĵ¦±±@bó±VÝ@ó¤w¯I@mÅóm±X¯IólK@°UllbzkKlln@@ÔºUmVk²ôÒxŎUVóLbmÈnmbnlax@z@Æ¦k'],
                    'encodeOffsets': [[
                            101251,
                            24734
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5334',
                'properties': {
                    'name': '迪庆藏族自治州',
                    'cp': [
                        99.4592,
                        27.9327
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WXw@akk@yk°īX¥Uóķ¯w@n»UaVaUÛ¯mV¼kÞċô@n¯xÛÒmV¯Ô@x@kwmÅa@UaÝ¯VÅyVa@ÿn»ÝVmankmmÞÅô@n£±ğzÇmU¦VmnÜmbn@°nV@xmzÅ@mºV¦k°ln¤¼õôn@xkÆIUxU@Ť¦VmVkmkXW¤XzVx@Æx¼Þ¯b@lVĸÞVm¼Xm¦VÞ@Æ¹Vón¥ÆKnKX¯x@èĊÈ±łXaÆxnlV@UÛlȻkğV¥m²ǉmÅÞĕƒƛm°ÆmX¤mznÆV¦ÞVVb°bnÞWbn°l@VÈ@VĵĊ±@óInxÆw¥@£ÞW¯ĸ£UUKk±akkkbmWmÈķaÆÇUÈÆW@wmknmU¯'],
                    'encodeOffsets': [[
                            102702,
                            28401
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5306',
                'properties': {
                    'name': '昭通市',
                    'cp': [
                        104.0955,
                        27.6031
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@mnK@wmUÅ¥móXǓŏmX@VmL@xţnk@mlUŻÒğŋ@L@mmLkm@bXÅW¼ka¯lÇŹ¯aÇ»ÝÝ_@m@@a@UklwUm@ak@bUmbmbV¯ĕUaVwÅaĉVmým¯xUk@k¥VUX¤VÈm`@ńÇÜ@ĀknĔkƞÆĠÞUVôƆÞI@UxÆ¦nl@ĊĊnxUÒ°¦Vb¯WUnWIml@xnUbô¤¼ÈxlI»KV@ÈÔJkUĖ±ÆVb@nVÜVUVLwĠlknĠ@nx°¥Æ²mUw@mmÅUl¯UÑÑUmLllIl±@VkwW@w°@U»kUóI°»ĢÑL`nUĠ²lmbôV@nJUxÆ¦X¦l@ŎUV@lVKVÅV£UaÞUnW@¯VU@ó'],
                    'encodeOffsets': [[
                            107787,
                            28244
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5301',
                'properties': {
                    'name': '昆明市',
                    'cp': [
                        102.9199,
                        25.4663
                    ],
                    'childNum': 11
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@n@VkVUn²°@x°V@¯ÆV¼k@WÞ¯@@VVUĢċ°k¼VĊx¤Ōx°mVkÑÈL°x°X°VmĊLVxUĖ°bX¦VW@kȯlkn@¥ln@»°Ñ¯VmlLUwVK@V@ka@lmXbUlVlkÈx@LVaVVwnmm@km@mIVaÝ@XVUÝ¯U@Ý£k»K@aUwkKV_¥a@alU@nz°aVÈ@@±lÛk@wVakm@Ñ¥az@XxÆW@ÛX@m@y@aWw@kōĉJlbVJzţÆUwVkmWkým@UlU@b¯wVºUVUêĠXUaUbVĊUWXUmkKWnUUUVVVÝ@kk±¯Lk±WkXlVkl@wXbmLVUIVmk@Ubma@kkaVKUkmlXLWnJ¯ÒĊ°@zkºlLUŤn@@nô@lÆnmKkÈlxVw@@mÈx@n²Uxl¤nbVxUzmJÒn'],
                    'encodeOffsets': [[
                            104828,
                            25999
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5307',
                'properties': {
                    'name': '丽江市',
                    'cp': [
                        100.448,
                        26.955
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l@@w°ÓUnÜÑ°w@mČóÝlU»n°VÜUbVbm¼@°xôĸVW¦¯Ĭl@zll@bWxXaX@ÆĠÆaXwl@XaÆ¦n¼Jn@mnKW¯È»V¯°akVanXVwl@VyUĕVUbÈīlaUk°k¯l²VUkƛô@I@mVwĊaVakaÆbUVLaXIWKUwaWÑÅKUaVk°@Uw¯¥XğÝLkm¯IÇóÑ¯»anUl±UĵÿlóÅIaU±Ik¼UVb¯bWxn°ÒVbnLlÞ@@`kbmIkVnJmnXl@Uxbkn@xóLUxVKóóÅWaÅxw@nÅmVôXLlVU¤b¦m¼@ĀbUzUÆ°ÞVb@Æbnx'],
                    'encodeOffsets': [[
                            101937,
                            28227
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5328',
                'properties': {
                    'name': '西双版纳傣族自治州',
                    'cp': [
                        100.8984,
                        21.8628
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l²°nÒlxÞ@nWlLĸnbV¤V¦kbVV¦nax°Vôa@b@lôXlWUVXČKlmU@bWXXÜ°LÈa°LnU°ÞnÑġ°lnba¯¯KWó@kmK@UĉV@k°VV¹a@y_ċl_nÓlL@anI@óWl£VUlkĕlKVwU@kVam¯ÅL@bÝk@VnUbÇbÝwÅ@ċ¥¯lk¼ÅÒ°b@¦nlUn@ÇVmÆbWôU@ÝÅōm¯aUmkWWw@±n¯UèaL¯mLkwl@°mnÈÒ¯ów@VxĀU¤°Į°Xl'],
                    'encodeOffsets': [[
                            102376,
                            22579
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5305',
                'properties': {
                    'name': '保山市',
                    'cp': [
                        99.0637,
                        24.9884
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@X°Il@¦È¼m¼ÞaÞÅlÈxV¼lVôÈÆlLÞ£ÈºlkUUw¯UĕVwĊ@n¦mlnVĸIWÇ°LnUwlVn@lnUnJÞl±U¯LVUa°ÝUÇĊýVŤéLlxÞLĀÜl²ĉ°KUaV_Źé@klw¯lÅW£ÅyUW@wknal¥Uw@wUk¯w¯aW±k_mJaXVÒĠWb¯L¯Ý@wwU¯±Wk_ġwwōKmb@¤bk°lĖôUJVnÅlťU¯°VbnbWxXmÞWUĀLyWzÛKmbUxVKknÝkVĀċ¤Ux@¯m@¦'],
                    'encodeOffsets': [[
                            100440,
                            25943
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5304',
                'properties': {
                    'name': '玉溪市',
                    'cp': [
                        101.9312,
                        23.8898
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lL°xXlWxXnlwaţlaÞlÆĬnX°wVwl@mnw°VVIXllKbnnV°lbUUJ@ÈÇKVb@bW°Vk¦kaWb°kxV¤È¼U°ôI@llbl²@@ó@mm@VţkKl¹@yĉ¯°ÑIXmWKnklVULlb@lnbVal@UnVJUnKWax@lkkUlW²XlK°l²@lÞUUUVVVXmlLVnXWVUĉVaVbWğVéUVU¹W»aVaaWX_U¥nÇķ¯@alUnÇUyk@@wW@kbW¦UKÝwUmmLUnVxUVVlk¯mmnmkÇaÅ¤¯I@l@@aĉw°ĕmUL±kÆéXÜÛ@yÈç@ÇġÝķXmmÝVÅlmnkbmWkb@nl@nm¯VxkJmUJml¯°makVVnV¦WWmnl@xmnlI¤nxUVUmX@b@zl@¦Ýþ'],
                    'encodeOffsets': [[
                            103703,
                            24874
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5333',
                'properties': {
                    'name': '怒江傈僳族自治州',
                    'cp': [
                        99.1516,
                        26.5594
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@WyX£lWlnnUU¥@ţVVwJlÅ@wmöó»£kml¯U¥n¹Æ@ny@wmU@¯mnamÛnUV¥ÈnĠy²m¤@ÆónÝnmlnbÞU¥aV£kUKWómIU¥ókwVól»¯Lk@mnaWKÛwóÑw@a±n@VbUJLkaÝXĉUV`lI@lnXÆƑkKmxÛXmlUKVmU²Klw@aaó@nKXwVKU¯V¥mUnkm¥ĉ@UxVĖ°VxVklmÞkKWĀkVWnl°Lnm@°UxlV@nk¦JVÈ°VÒ@nX°@ÆlUômlnô²nxmłnVV¯x@Èm°XblVUl°@xkXU¤WXXWXÆmkÅJmÞw±bxUīkKmÅVUĖÝèVkx@lXlnk¤LkĖk¦xUL°¯Ė@LnK@b°xVI¥Ua°Ñ@»nm@¹KŎÞÈWln²n'],
                    'encodeOffsets': [[
                            101071,
                            28891
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '5331',
                'properties': {
                    'name': '德宏傣族景颇族自治州',
                    'cp': [
                        98.1299,
                        24.5874
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@¥n@°@VwČ£ÿUlÞlmULVwnaÜLXyzKVÿXÝnWXwmaUa°¯VŦÆkUmVIókĕl¯a@£nama@¯m¯ó@óyţbġkÅm±ÛammVkLwU`Wk@VkUmÅlUUKmbkkUVUw¦ó°¼bn°ô¦lºz@x¯@U°nU¤ţU°VƆ@ÈmlnzÞl°¦ÆaxUxLkxWƒn@²ŰW@°ÈXl°Llx'],
                    'encodeOffsets': [[
                            100440,
                            25943
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});define('echarts/util/mapData/geoJson/zhe_jiang_geo', [], function () {
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': '3311',
                'properties': {
                    'name': '丽水市',
                    'cp': [
                        119.5642,
                        28.1854
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@VbVl@XnUXKV@¦nxlUXVnKVmnLUV@bn¤lLXK²`nnlJXIVJIVnn°KnnVll@VLXWV@UkVaVKzV@VVaUK@U»VUl@@WnUU@wVLn@Vwl@XW°LVbn@VU@Xl`@XnKVbkl@XVJlUnlVxlL@lnXl@VUnV°°@aUVLXblWVXn@VVUV@L¤VLVUVbnalLUUVX_laVaWVzXKV@@a@KUmImmXama@kU@yVIUKaVa@kXK@aWU@VIUmW@kkVmU@VwUa@K@k@U`@kUKVk@UV@VaUm²Vy@klUUWUkVmUa@_KVaXaXmU@mUlWkaUX@mmkL@wJnVVÅbWKXa@@I@aJUUÇ@VULW@akLmb@K@aXXw@mVmUVkUy@£@aU@@VkUWm@kUKXUWU_mW@wkkmJUUkLWWUXW@IkJ@k@mW_kÓ_UlLm@I@aUa¯m@ka¯LUJ@mVVxUba@LUKkXbm@Uak@@a@Um`IUbUJ@nUVW@@LnVV@lUbVlUX@`@blXklWUmXlm¦U@@V¯bml@@nUb@llnn@VbX@lV@UVULmU@JVnbVbkbVWxU@@nUVk@'],
                    'encodeOffsets': [[
                            121546,
                            28992
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3301',
                'properties': {
                    'name': '杭州市',
                    'cp': [
                        119.5313,
                        29.8773
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@X@l°KXXlWb@²`bIX`l@@bWl@n@VnLUV@V@°¦@l@XVlU@@xVbUb@Vkb@@XVJVzJ@LÞ@VmLUxUJ@LUVxbxXUl@VaÈwbaÞa@Vl@XUVx@V@VLlbnVal@lbVnnLnKnL@VlbVJXalIb@KUU@mVInJUVl@xUVLnU@UÞaV@lkV@UanKL@UlKVUnbÆmn@@nUlVnVJl@@UXUL@WVIVJVxVLXV@IÜKnbn@V¥V@@I@y°b@UUwnk°ÆƨVlUçXm£aÇIkV@WV@@aWIUWUIkb@WW@UnK@UU@kaWVkVIVVnU@UWVUV@VmVkKkWIkVWaULU`UImJUImmU@wmwUVIUWVkUamaU@mVkb@KVU@aVU@anKULVJU@kÛUJUVkkVakU@aVwkW@UWkXmWaULUaUK@XJUUmVU@UVUkJ@ImwmKU@k@lUW@@akKmkamIkWl_UwVm@UkaVUUa@UamakbWlkL@aUalU@mkL@U@UlmK@XkKm@Ýakb@xnXb`nUUU@U@wU@@mKkkV¯U@lULUbVbUb@Va@LºÝb@bLmKx@VUL@bk@mxULWl'],
                    'encodeOffsets': [[
                            121185,
                            30184
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3303',
                'properties': {
                    'name': '温州市',
                    'cp': [
                        120.498,
                        27.8119
                    ],
                    'childNum': 9
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@ll@xnXV`VXWVL@lXnlV@UV@@b@¤VzUlnVU@nWxW@b@LnalK@bXVKUÈ@VVI@b@J@WbXLÆaUUmI@xlKnn@VWlbkXV@nVWnWbUbL@`VbUnVlVXkV@lUz±VnUbU@@VUlVL@l_@V@l@LVbV@XLV`VÈlxn@lU@aaVVk@XJ@nl@@LU`°LVbL°a@aUVy@anI@aanV@²wÜJX@VVV°kna@WVkaWwU@m@kaUĕÝÝŤnÈaaóI»@±XWkUķ@kV±kwUkWwUÝ»ÛkɳlImaUaWóXÿǬkUnWVmmkKţnŏÞğlUlUx@XWbV@JkX°mb@VULVxUVk@@LWWk@WIkUkJmUkVmI@y@UakLmU@mUUUkaVk@mK@UlUU@UmKmbUUUJ@n@KVLUL@VkJWXX`mnULWlkL@JVLVb@°kxkU@LVV@VLV`UL@VUX'],
                    'encodeOffsets': [[
                            122502,
                            28334
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3302',
                'properties': {
                    'name': '宁波市',
                    'cp': [
                        121.5967,
                        29.6466
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@Ċ¦ĸĀ°nXÞVKkƨƑźÿ°»n@wô¥ÜbU°ÆXÞWóçĉÝ±IUÈ¥@U°wÆ»²mm_@aXVKÞVlk@akk̅@£X»VwÆXWa¯aȗbKƽŰĊxLók@@¯nKUL@xkLÑkWULUUmJUXVU@mUX¯@V`mbXbV@@nn¤WXx@kJ@nVVUVl²UbÝVUVk@Wx@V@VXzmlaL@VlLU`XUVVVUnl@VbnJlnUVVnlUKkbmnnVxlJnxmbU@UL@KUVX@xmb@lk@mnVVUè'],
                    'encodeOffsets': [[
                            123784,
                            30977
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3309',
                'properties': {
                    'name': '舟山市',
                    'cp': [
                        122.2559,
                        30.2234
                    ],
                    'childNum': 3
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@l΢ƒʠþÆVĢLĊǬXĊÜXôVÑÆwlƏÈóVĭVǓ@ĉwɛkmK@ĉXīWaĉUĵÝm¯ĉwĉ±±nÅ¼¯x@VÇ¦V²JĊÞôèÝXÅW¯VÛaó¦@xm¯¼ŹĀ'],
                    'encodeOffsets': [[
                            124437,
                            30983
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3310',
                'properties': {
                    'name': '台州市',
                    'cp': [
                        121.1353,
                        28.6688
                    ],
                    'childNum': 7
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@lVIVWVz@bXJl@Xal@°nLll@nVxnVK@UJVb¦°k`UIWJXnÆ@bUJXl@lbWn@UzVV@bVVmVnnJVXnabKUKnUVVUnVLlKVLXaJm£@mU@WanaU_°@VWnV@UVWnIVVVKlXÒlK@wVKL°m@l@ôKwĉƾůUl£@»UVkm@ƅUaÛIŏmUk@mw@a£Wk@ţIm±@ankôUlaUUw¯ōabÇbţmÞÞVĖbl@@nVXxbUl@Xmb¯lUUUW@ÛI±xU@mb@bmJ@bUzV@b¯bKUa¯KV_@Kk@@mWI@lUUb@bkVm@kwUÇU_WKU@Ux@VUnllX@VnJ@UXV@bWL@lUbbVLUJ@zV@lnbWbnnnJV@L'],
                    'encodeOffsets': [[
                            123312,
                            29526
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3307',
                'properties': {
                    'name': '金华市',
                    'cp': [
                        120.0037,
                        29.1028
                    ],
                    'childNum': 8
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@nbVb@VbUVlb@VUnVxk`lXnJlbnlL@bX@V@klV@nLnx@JlIVU@VUVnVVI@WVLVbVKXbWnXl@VlXUxb@lVUbllVUIÜVnalKX@@bV@@aUUlUwUw@naWWUVaUUaVbLlxXJVk°UlkU¥@ka@LVlXLVlVWznVn@lxJl_@WX_@mVaa@alU@kVVnaKVLlKb@UUaVabnUWmXU@k@yVI@aÅWmXIVJl_¯¥UaVI@LmUUw@mkkmK¯k@Wbk@WI@aUyUXJkU@bU@WLUyXUbkbW`UVVkKmbUaVUUK£@KVUUUm@UWkXWaUKV@b¯¯mUV@UkmW@kkKwUmkkVUI@WlkUamL@Wk_W@UVm@Ua¯KWXk@Uxm@UK@xVmV@Xk@UVV¼@VLUbUU@yULUbVlU@@XlVUVVbU@lXXVW@XUVl@@VUVÈn@VVU@lVa@UmL@`X@`WL@VUX@lUL@xlx'],
                    'encodeOffsets': [[
                            122119,
                            29948
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3308',
                'properties': {
                    'name': '衢州市',
                    'cp': [
                        118.6853,
                        28.8666
                    ],
                    'childNum': 5
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@XkVKnwl@@aVK@UwnLK@aÞa¹@Kb@UVaUaVaVK@k°VUllnL@V@xV@V@VVm_Wam@wlaÞbn@lL@WnLk@V@VlK@nkVVb@blKXklakw@wVK@kVW@UXK@_W@_nKV@Ub@kVUUm@ÇVU@Uk@VU@WUXWW@kVUaVUkU@WWXUKk@Ukmm¯LmmUJUIWJkImm_±WLkKm£@aVUmKUnLmWUkVmw@¥ULVWm@WUka@UmmLmm@@bUX@@WUIm@UVUK@UVUUUVVJmb@bXnmV¼nnn¦mJUVLV@VW@UzUlVnUbl`UnVl@XU@kl@bmÈUxVk@@J@¼W@ÅaVVnzmV@WJk@kWJ@lXbWbXxmVnlLXb@°lKVXnWbWVXmbV@XlbI@Kn@@x@VLlm'],
                    'encodeOffsets': [[
                            121185,
                            30184
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3306',
                'properties': {
                    'name': '绍兴市',
                    'cp': [
                        120.564,
                        29.7565
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@x@VnnVJnIVJV_VKXblUXJllLUUnU@UVVX@mVUUUJlXUlbV@@VLVmX@@XlaVJVXXJ@b@XU@lUJÈb¤ŌJçVUUnml@@kna@wWVU@LVKV@namwkIUwmnmlaVLkUmVUkmmIUak@VmUUVUWV_kK@UKbnkWyU@@UXwl@VUÞUVak±VUUU@mlI@wXWIWbUKkLUKVmUUmVVLLambUWmIUmnUU@aUUVym@Xkak@W@z@lWVXnmVaUbVb@VakLUKLmbUU@lkV@bbUb@nW`@Xk`Ikwm@mUXyUUkWKUk@Kb@lV¦klV¯UlWIkwKUabVVUbVXXmb@VxxkVVV@bU@@aW@kLmb@lVUIVKmL@bUV@bUV@LalnUV@nbVbUlVXJVUnx'],
                    'encodeOffsets': [[
                            122997,
                            30561
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3304',
                'properties': {
                    'name': '嘉兴市',
                    'cp': [
                        120.9155,
                        30.6354
                    ],
                    'childNum': 6
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@@blIX@@VÜVUnn@lklKnI°Þl`²LVKVbnbVaVLUVn@W¦@VkVVb@VI`@blLnLaX@VVb@U@XlVa@@kVaUKV»U_lWXU@albk@VllnLVKn@@UVIUw@y°IVVXU@VV@lwm@wVkƾaJLkΡƧƒlLÝUmW¯ķÿĉ¥IŋWnèkVƧU¯ÅmlVx@V¯az@@JU@U¦m@@nVmn@VLV'],
                    'encodeOffsets': [[
                            123233,
                            31382
                        ]]
                }
            },
            {
                'type': 'Feature',
                'id': '3305',
                'properties': {
                    'name': '湖州市',
                    'cp': [
                        119.8608,
                        30.7782
                    ],
                    'childNum': 4
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': ['@@kLlkm@VmÛU@UW@kJ@aUK@UnmmU@maÛL@JWUUKUwUIUJ@XKWV@Vk@UIUmVk@mm@ÅnmaUVkL@VKmLVbU@klU@ÝbV@mVUKV@wUkVmIUJ@nVV@LakJWbUIka@UmKmLKmmUUVk@@nmLX`WXUV@@nUlkmlU@UbxVVIlVnn@@nUÒ@°n@@xmb@VbnV@@b@`@L@L@x@blVklVbnnV@aXb°VlU@Wb°ULXWVUVVwÈwÜ»ĸaĠnUVw²X@V@lVU@wlaUUVm@knUV'],
                    'encodeOffsets': [[
                            123379,
                            31500
                        ]]
                }
            }
        ],
        'UTF8Encoding': true
    };
});