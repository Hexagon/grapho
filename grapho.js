/*

Grapho

Copyright (c) 2014 Robin Nilsson <robinnilsson@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
(function (self, factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], factory);
	} else {
		// Attaches to the current ctx.
		self.Grapho = factory();
	}
}(this, function () { 
	'use strict';


	var 
		// A collection of all instantiated Grapho's
		graphos = [],

		// Label formatters, used through Grapho.formats.x
		formats = {
			default: function (l) {
				// Check if we got a number, else just return
				var i;
				if (helpers.math.isNumber(l)) {
					// Protext against very-very-close to ints
					if (Math.round(l,19) === (i = parseInt(l))) {
						return i;
					} else {
						return l;
					}
				} else {
					return l;	
				}
				
			},

			datetime: function (l) {
				return helpers.math.isNumber(l) ? new Date(l*1000).toLocaleString() : l;
			},

			date: function (l) {
				return helpers.math.isNumber(l) ? new Date(l*1000).toLocaleDateString() : l;
			},

			time: function (l) {
				return helpers.math.isNumber(l) ? new Date(l*1000).toLocaleTimeString() : l;
			}
		},

		// Reasonable defaults for everything
		defaults = {
			settings: {
				// Used for all chart types
				margin: 5,
				showLegend: false,
				fillStyle: 'rgb(0,0,0,0)', // Only used for pie right now, but could be used for all

				// Used for pie
				startAngle: 90,
				sizePercent: 1,
				relative: true,
				innerMargin: 3
			},
			dataset: {
				type: 'line', // line || scatter || area || bar

				x: { axis: 1 },
				y: { axis: 1 },

				// type: 'line' or 'area'
				lineWidth: 2,
				lineSmooth: true,
				strokeStyle: '#454545',
				fillStyle: '#343536',
				lineDots: false,
				shadow: true,

				// type: scatter || lineDots: true
				dotWidth: 4,

				// type: 'bar'
				barWidthPrc: 90,

				// Internal stuff
				_labels: [],
				_usedPos: [],				// Used for stacking charts
				_usedNeg: [],
				_data: [] 					// Internal representation of the data
			},
			axis: {
				min: 'auto',
				max: 'auto',
				showscale: false,
				scaleStyle: '#FFFFFF',
				gridLines: false,
				gridStyle: '#353637',
				name: undefined,
				font: '10px Droid Sans',
				labelFormat: formats.default,
				labelRotation: 0,
				showlabels: false,
				showCenter: false,
				majorTickHeight: 4,
				minorTickHeight: 2,
				center: 0,
				padded: false,
				stacked: false,
				numeric: true,				// Handle this as an numerical (continouos) axis, or a text-axis
				
				// Used internaly
				_textSize: 0,				// Parsed height of font in pixels
				_h: undefined,
				_step: Infinity,
				_steps: 0,
				_minStepPrc: 1,
				_range: 0,
				_startMinVal: 0,			// Used as the starting point when drawing grid, ticks and stuff
				_minVal: Infinity,
				_maxVal: -Infinity,
				_padded: false, 			// Padding adds a half step to the width, usable for bar charts

				_values: [],
				_labels: [],
				_usedPos: [],				// Used for stacking charts
				_usedNeg: []
				
			},
			legend: {
				position: 'bottom',
				inside: false,
				fillStyle: 'none',
				strokeStyle: 'none',
				font: '11px Droid Sans'
			}
		},

		// Grapho helper functions
		helpers = {

			// Array helpers
			array: {	
				is: Array.isArray || function (it) {
					return Object.prototype.toString.call(it) === '[object Array]';
				},
				unique: function(ain) {
					var u = {}, a = [];
					for (var i = 0, l = ain.length; i < l; ++i) {
						if(u.hasOwnProperty(ain[i])) {
							continue;
						}
						a.push(ain[i]);
						u[ain[i]] = 1;
					}
					return a;
				}
			},

			// Object helpers
			object: {
				merge: function(target, source, recurse) {
					var name;

					// Make sure we get a true deep copy
					if(recurse === undefined) { 
						target = helpers.object.merge({},target,true);
					}

					for (name in source) {

						// Why don't we copy undefineds? I don't know, but the code is here :)
						if (source[name] !== undefined) {

							// Recurse into objects
							if (target[name] && Object.prototype.toString.call(target[name]) === '[object Object]') {
								target[name] = helpers.object.merge(helpers.object.merge({},target[name]), source[name],true);

							// Special handling for arrays, .slice() makes a deep copy of the array.
							// A potential pitfall here is if the array contains child objects. Ignored for now.
							} else if (helpers.array.is(source[name]) === '[object Array]') {
								target[name] = source[name].slice();

							// Regular parameters is copied as-is
							} else {
								target[name] = source[name];
							}
						}
					}

					return target;
				}
			},

			// Renderers
			renderers: {
				line: function(grapho, context, dataset, xAxis, yAxis) {
					var point, i,
						next, npxp, mpxpdiff, pad, innerWidth,
						px, // Current X-pixel
						py, // Current Y-pixel
						cy, // Center Y-pixel
						fpx, // First X-pixel
						pxp; // Pixel percentage

					context.beginPath();

					mpxpdiff = xAxis._minStepPrc;
					mpxpdiff = mpxpdiff * (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					pad = (xAxis._padded)?mpxpdiff/2:0;
					innerWidth = (grapho.wsw-pad*2);

					// Primary line
					for ( i = 0; i < dataset.data.length; i++) {
						if ((point = dataset.data[i])) {

							pxp = (point[0] - xAxis._minVal) / (xAxis._range);

							px = Math.round(grapho.wox + pad + ((innerWidth) * pxp));
							py = Math.round(grapho.woy + ((point[1] + point[3]) - yAxis._minVal) / (yAxis._range) * grapho.wsh);

							if (!i) {
								// Keep track of first pixel, for later use by area charts
								context.moveTo((fpx = px+1), py);
							} else if (dataset.lineSmooth && i < dataset.data.length - 1) {
								next = dataset.data[i + 1];
								npxp = (next[0] - xAxis._minVal) / (xAxis._range);
								context.quadraticCurveTo(
									px, // The x-coordinate of the Bézier control point
									py, // The y-coordinate of the Bézier control point
									(px+(!next ? 0 : Math.round(grapho.wox + pad + ((innerWidth) * npxp)))) / 2, // The x-coordinate of the ending point
									(py+(!next ? 0 : Math.round(grapho.woy + (next[1] - yAxis._minVal) / (yAxis._range) * grapho.wsh))) / 2 // The y-coordinate of the ending point
								);
							} else {
								context.lineTo(px-1, py);
							}
						}
					}
					context.lineWidth = dataset.lineWidth;
					context.strokeStyle = dataset.strokeStyle;
					context.stroke();
					
					if (dataset.type === 'area') {

						cy = Math.round(grapho.woy + ((yAxis.center < yAxis._minVal ? yAxis._minVal : (yAxis.center > yAxis._maxVal ? yAxis._maxVal : yAxis.center )) - yAxis._minVal) / (yAxis._range) * grapho.wsh)+0.5;

						context.lineTo(px-1, cy); // Move to center at last col
						context.lineTo(fpx, cy); // Move to center at first col

						// Empty stroke, as we just want to move the cursor
						context.strokeStyle = 'rgba(0,0,0,0)';
						context.stroke();

						// Fill the area
						context.fillStyle = dataset.fillStyle;	
						context.fill();
					}
				},
				band: function(grapho, context, dataset, xAxis, yAxis) {
					var point, i,
						next, npxp, mpxpdiff, pad, innerWidth,
						px, // Current X-pixel
						py, // Current Y-pixel
						cy, // Center Y-pixel
						fpx, // First X-pixel
						fpy, // First Y-pixel
						pxp; // Pixel percentage

					context.beginPath();

					mpxpdiff = xAxis._minStepPrc;
					mpxpdiff = mpxpdiff * (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					pad = (xAxis._padded)?mpxpdiff/2:0;
					innerWidth = (grapho.wsw-pad*2);

					// High line
					for ( i = 0; i < dataset.data.length; i++) {
						if ((point = dataset.data[i])) {

							pxp = (point[0] - xAxis._minVal) / (xAxis._range);

							px = Math.round(grapho.wox + pad + ((innerWidth) * pxp));
							py = Math.round(grapho.woy + ((point[1][0]) - yAxis._minVal) / (yAxis._range) * grapho.wsh);

							if (!i) {
								// Keep track of first pixel, for later use by area charts
								context.moveTo((fpx = px+1), (fpy = py));
							} else if (dataset.lineSmooth && i < dataset.data.length - 1) {
								next = dataset.data[i + 1];
								npxp = (next[0] - xAxis._minVal) / (xAxis._range);
								context.quadraticCurveTo(
									px, // The x-coordinate of the Bézier control point
									py, // The y-coordinate of the Bézier control point
									(px+(!next ? 0 : Math.round(grapho.wox + pad + ((innerWidth) * npxp)))) / 2, // The x-coordinate of the ending point
									(py+(!next ? 0 : Math.round(grapho.woy + (next[1][0] - yAxis._minVal) / (yAxis._range) * grapho.wsh))) / 2 // The y-coordinate of the ending point
								);
							} else {
								context.lineTo(px-1, py);
							}
						}
					}
					// Low line
					for ( i = dataset.data.length-1; i >= 0; i--) {
						if ((point = dataset.data[i])) {

							pxp = (point[0] - xAxis._minVal) / (xAxis._range);

							px = Math.round(grapho.wox + pad + ((innerWidth) * pxp));
							py = Math.round(grapho.woy + ((point[1][1]) - yAxis._minVal) / (yAxis._range) * grapho.wsh);
							if (i==dataset.data.length-1) {
								// Keep track of first pixel, for later use by area charts
								context.lineTo((px+1), py);
							} else if (dataset.lineSmooth && i >= 1 ) {
								next = dataset.data[i - 1];
								npxp = (next[0] - xAxis._minVal) / (xAxis._range);
								context.quadraticCurveTo(
									px, // The x-coordinate of the Bézier control point
									py, // The y-coordinate of the Bézier control point
									(px+(!next ? 0 : Math.round(grapho.wox + pad + ((innerWidth) * npxp)))) / 2, // The x-coordinate of the ending point
									(py+(!next ? 0 : Math.round(grapho.woy + (next[1][1] - yAxis._minVal) / (yAxis._range) * grapho.wsh))) / 2 // The y-coordinate of the ending point
								);
							} else {
								context.lineTo(px-1, py);
							}
						}
					}

					cy = Math.round(grapho.woy + ((yAxis.center < yAxis._minVal ? yAxis._minVal : (yAxis.center > yAxis._maxVal ? yAxis._maxVal : yAxis.center )) - yAxis._minVal) / (yAxis._range) * grapho.wsh)+0.5;

					context.moveTo(fpx, fpy); // Move to center at first col

					// Fill the area
					context.fillStyle = dataset.fillStyle;	
					context.fill();
				},
				error: function(grapho, context, dataset, xAxis, yAxis) {
					var point, i,
						next, npxp, mpxpdiff, pad, innerWidth, barWidth, barSpacing, center, ct,
						px, // Current X-pixel
						pyh, // Current Y-pixel high
						pyl, // Current Y-pixel low;

					mpxpdiff = xAxis._minStepPrc;
					mpxpdiff = mpxpdiff * (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					pad = (xAxis._padded)?mpxpdiff/2:0;
					innerWidth = (grapho.wsw-pad*2);

					barSpacing 	= mpxpdiff*(100-dataset.barWidthPrc)/100;
					barWidth 	= mpxpdiff-barSpacing;

					context.strokeStyle = dataset.strokeStyle;

					for ( i = 0; i < dataset.data.length; i++) {
						if ((point = dataset.data[i])) {
							
							ct = (center < yAxis._minVal) ? yAxis._minVal : center;
							
							px = Math.round(grapho.wox - mpxpdiff/2 + pad + barSpacing/2 + ((point[0] - xAxis._minVal) / (xAxis._range) * innerWidth));
							pyh = Math.round(grapho.woy + (point[1][0] - yAxis._minVal) / (yAxis._range) * grapho.wsh);
							pyl = Math.round(grapho.woy + (point[1][1] - yAxis._minVal) / (yAxis._range) * grapho.wsh);

							// High line
							context.beginPath();
							context.moveTo(px,pyh);
							context.lineTo(px+barWidth,pyh);
							context.stroke();

							// Connecting line
							context.beginPath();
							context.moveTo(Math.round(px+barWidth/2),pyh);
							context.lineTo(Math.round(px+barWidth/2),pyl);
							context.stroke();

							// Low line
							context.beginPath();
							context.moveTo(px,pyl);
							context.lineTo(px+barWidth,pyl);
							context.stroke();
						}
					}
				},
				bar: function (grapho, context, dataset, xAxis, yAxis) {
					var point, pxp, pad, mpxpdiff, i,
						barSpacing,
						barWidth,
						px,
						py,
						bh,
						heightflag,
						innerWidth,
						ct, // Center temp
						center = yAxis.center;
					

					mpxpdiff = xAxis._minStepPrc;
					mpxpdiff = mpxpdiff * (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					pad = (xAxis._padded)?mpxpdiff/2:0;
					innerWidth = (grapho.wsw-pad*2);

					barSpacing 	= mpxpdiff*(100-dataset.barWidthPrc)/100;
					barWidth 	= mpxpdiff-barSpacing;

					for ( i=0; i < dataset.data.length; i++) {
						// We might need to skip some points that are not in the dataset
						if ((point = dataset.data[i])) {

							pxp = (point[0] - xAxis._minVal) / (xAxis._range);
							
							ct = (center < yAxis._minVal) ? yAxis._minVal : center;
							
							px = Math.round(grapho.wox - mpxpdiff/2 + pad + barSpacing/2 + (pxp * innerWidth));
							py = Math.round(grapho.woy + ((point[1] + point[3]) - yAxis._minVal) / (yAxis._range) * grapho.wsh);
							bh = Math.round(grapho.woy + (point[3] - yAxis._minVal) / (yAxis._range) * grapho.wsh)-py;

							// Use strokestyle instead of fillstyle when height > lineWidth*2
							if((heightflag = (Math.abs(bh)>dataset.lineWidth*2))) {
								context.fillStyle = dataset.fillStyle;
							} else {
								context.fillStyle = dataset.strokeStyle;
							}
							context.fillRect(px, py, barWidth, bh);

							if (dataset.lineWidth > 0 && heightflag) {
								context.strokeStyle = dataset.strokeStyle;
								context.lineWidth = dataset.lineWidth;
								context.strokeRect(Math.round(px+context.lineWidth/2), Math.round(py-context.lineWidth/2), barWidth-context.lineWidth-0.5, bh+context.lineWidth-1);
							}

						}
					}
				},
				scatter: function (grapho, context, dataset, xAxis, yAxis) {
					var point, pxp, mpxpdiff, pad, i, innerWidth;

					mpxpdiff = xAxis._minStepPrc;
					mpxpdiff = mpxpdiff * (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					pad = (xAxis._padded)?mpxpdiff/2:0;
					innerWidth = (grapho.wsw-pad*2);

					for ( i=0; i < dataset.data.length; i++) {
						// We might need to skip some points that are not in the dataset
						if ((point = dataset.data[i])) {
							pxp = (point[0] - xAxis._minVal) / xAxis._range;
							context.beginPath();
					     	context.arc(
					     		Math.round(grapho.wox + pad + ((innerWidth) * pxp)), // The x-coordinate of the center of the circle
					     		Math.round(grapho.woy + (((point[1] + point[3]) - yAxis._minVal) / yAxis._range) * grapho.wsh), // The y-coordinate of the center of the circle
					     		dataset.dotWidth, // The radius of the circle
					     		0, // The starting angle, in radians (0 is at the 3 o'clock position of the arc's circle)
					     		Math.PI * 2 // The ending angle, in radians
					     	);
					     	context.fillStyle = dataset.fillStyle;
					     	context.fill();
					    }
					}
				},
				pie: function (grapho, context, dataset, xAxis, yAxis) {
					var i,outerBound = 1, innerBound = 1-grapho.settings.sizePercent, step;

					function fillSegment(grapho, context, startAngle, endAngle, outerRadiusPerc, innerRadiusPerc, fill) {
					    var centerX = (grapho.wsw/2) + grapho.wox,
					    	centerY = (grapho.wsh/2) + grapho.woy,
					    	radiusOuter = ((grapho.wsw > grapho.wsh) ? grapho.wsh/2: grapho.wsw/2) * outerRadiusPerc,
					    	radiusInner = ((grapho.wsw > grapho.wsh) ? grapho.wsh/2: grapho.wsw/2) * innerRadiusPerc + grapho.settings.innerMargin,
					    	startingAngle = (startAngle+grapho.settings.startAngle)*helpers.math.degToRad,
					    	arcSize = (endAngle+0.5)*helpers.math.degToRad,
					    	endingAngle = startingAngle + arcSize;

					    fill = fill === undefined ? true : fill;

					    context.beginPath();
					    context.arc(centerX, centerY, radiusOuter, startingAngle, endingAngle, false);
						context.arc(centerX, centerY, radiusInner, endingAngle ,startingAngle, true);
					    context.closePath();

					    context.fill();

					}
					// Fill segments
					for ( i=0; i < dataset.data.length; i++) {
						step = outerBound-(i/(dataset.data.length))*(outerBound-innerBound);
						context.fillStyle = dataset.fillStyle;
						fillSegment(
							grapho,
							context,
							dataset.data[i][3]/yAxis._usedPos[i]*360,
							dataset.data[i][1]/yAxis._usedPos[i]*360,
							step+0.01,
							step-(1/(dataset.data.length))*(outerBound-innerBound)
						);
					}
				}
			},

			// Math helpers
			math: {
				degToRad: 0.0174532925,
				log10: function(x) {
				  return Math.log(x) / Math.LN10;
				},
				isNumber: function(n) {
				  return !isNaN(parseFloat(n)) && isFinite(n);
				},
				isInt: function(n) {
				   return n % 1 === 0;
				},
				bboxrot: function(w,h,deg) {

					var theta = helpers.math.degToRad * deg,w2,h2,w3,h3;

					w=w/2; h=h/2;
					w2 = w*Math.cos(theta)+h*Math.sin(theta);
					h2 = -w*Math.sin(theta)+h*Math.cos(theta);

					w3 = w*Math.cos(theta)-h*Math.sin(theta);
					h3 = -w*Math.sin(theta)-h*Math.cos(theta);

					return {
						width: Math.round(Math.max(Math.abs(w2*2),Math.abs(w3*2))),
						height: Math.round(Math.max(Math.abs(h2*2),Math.abs(h3*2)))
					};
				}
			}
		},

		// Shortcuts
		prot;

	// The actal Grapho object
	function Grapho (settings) {
		var place;

		// Protect against forgotten `new` keyword.
		if (!(this instanceof Grapho)) {
			return new Grapho(settings);
		}

		// Setup default settings
		this.yAxises = [];
		this.xAxises = [];
		this.datasets = [];

		this.container = {
			width: 'auto',
			height: 'auto'
		};

		this.settings = defaults.settings;

		// Merge the user settings into `this`
		if (settings!==undefined) {
			this.settings = helpers.object.merge(this.settings, settings);
		}

		this.legend = helpers.object.merge(defaults.legend, settings.legend);

		// These aren't settings but needed properties.
		this.id = graphos.push(this) - 1;

		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');

		// Element width and height
		this.w = 0;
		this.h = 0;

		// Workspace width and height
		this.wsw = 0;
		this.wsh = 0;

		// Workspace offset x and y
		this.wox = 0;
		this.woy = 0;

		// Negative workspace offset x and y
		this.nwox = 0;
		this.nwoy = 0;

		// Call the this.place() method if the user has specified an parent.
		if (settings.place) {
			this.place(settings.place);
		}

		// Init done
		this.done = true;

	}

	// Prototype shortcut, hopefully makes minified code more compact
	prot = Grapho.prototype;
	
	Grapho.formats = prot.formats = formats;

	// Place the grapho
	prot.place = function (newDestination) { 
		var method;

		if (typeof newDestination === 'string') {
			newDestination = document.getElementById(newDestination);
		}

		if ((method = (newDestination && (newDestination.appendChild ? 'appendChild' : 'append')))) {
			this.dest = newDestination;
			this.dest[method](this.canvas);
			this.resize(this);
		}

		return this;
	};

	prot.initAxis = function (props,dest) {
		var def = defaults.axis,
			index = props.axis;

		if (typeof index === 'number' && isFinite(index) && index % 1 ===0) {

			if (dest[index] === undefined) {

				// Merge properties, if passed
				if (typeof props === 'object') {
					def = helpers.object.merge(def, props);
				}

				dest[index] = def;

			} else {
				// Merge current with new settings, if passed
				if (typeof props === 'object') {

					def = helpers.object.merge(dest[index], props);
					dest[index] = def;

				}
			}
		}

		return this;
	};

	prot.removeDataset = function(dataset) {
		var dsIndex;

		dsIndex = this.datasets.indexOf(dataset);

		if (dsIndex !== -1) {
			this.datasets.splice(dsIndex);
		}

	};

	prot.addDataset = function (dataset) {
		var datasetIsArray = helpers.array.is(dataset);

		// Check that we got some type of valid object as parameter
		if (typeof dataset !== 'object' ) {
			return this;
		} else if (!datasetIsArray && !dataset.data) {
			return this;
		}

		// Define some reasonable defaults for each dataset
		var def = defaults.dataset;

		// `dataset` can be either an array or an object.
		if (datasetIsArray) {
			def.data = dataset;
		} else {
			def = helpers.object.merge(def, dataset);
		}

		// Modify defaults for bar charts
		if ( dataset.type === 'bar' && dataset.lineWidth === undefined) {
			def.lineWidth = 0;
		}

		// Make sure the axis exists
		this.initAxis(def.y,this.yAxises);
		this.initAxis(def.x,this.xAxises);

		// Push dataset to axis
		this.pushDataset(def);

		// Redraw, but only if the object is fully initiated
		if (this.done === true) {
			this.redraw();
		}

		// Return the object, so that the user can reference to it while removing
		// Hence, not chainable :(
		return def;
	};

	prot.updateAxises = function (dataset) {
		var yAxis = this.yAxises[dataset.y.axis],
			xAxis = this.xAxises[dataset.x.axis],
			i, j, 
			tryindex,
			datasetLen = dataset.data.length,
			cleanDataY = [],
			cleanDataX = [];

		// If we got a single element dataset ( [4,3,2,...] , expand it into [ [0,4] , [1,3] , [2,2] , ]
		if (!helpers.array.is(dataset.data[0])) {
			for (i = 0; i < datasetLen; i++) {
				cleanDataY[i] = dataset.data[i];
				cleanDataX[i] = i;
				dataset.data[i] = [i, dataset.data[i]];
			}
		}

		// Do some magic
		for (i = 0; i < datasetLen; i++) {

			// Restore eventual string to [i][0] for re-evaluation
			if(dataset.data[i][2] !== undefined) {
				dataset.data[i][0] = dataset.data[i][2];
			}

			// Find out if this is an existing string
			tryindex = -1;
			for (j = 0; j < xAxis._labels.length; j++) {
				if (xAxis._labels[j] === dataset.data[i][0]) {
					tryindex = j;
				}
			}

			dataset.data[i][2] = dataset.data[i][0];
			if(tryindex > -1) {
				dataset.data[i][0] = cleanDataX[i] = tryindex;
			} else {
				tryindex = xAxis._labels.push(dataset.data[i][0])-1;
				dataset.data[i][0] = cleanDataX[i] = tryindex;	
			}

			if(!helpers.array.is(dataset.data[i][1])) {
				cleanDataY[i] = dataset.data[i][1];
			} else {
				cleanDataY = cleanDataY.concat(dataset.data[i][1]);
			}

			// Add to 'used', if not of multiple value type (bands, ohlc etc)
			dataset.data[i][3] = 0;
			if (!helpers.array.is(dataset.data[i][1])) {
				if (yAxis._usedPos[tryindex] === undefined) { yAxis._usedPos[tryindex] = 0; }
				if (yAxis._usedNeg[tryindex] === undefined) { yAxis._usedNeg[tryindex] = 0; }
				if (yAxis.stacked || dataset.type === 'pie' || dataset.type === 'progress') {
					if (dataset.data[i][1]>=yAxis.center) {
						dataset._usedPos[tryindex] = dataset.data[i][3] = (yAxis._usedPos[tryindex] === undefined) ? 0 : yAxis._usedPos[tryindex];
						yAxis._usedPos[tryindex] += dataset.data[i][1];
					} else {
						dataset._usedNeg[tryindex] = dataset.data[i][3] = (yAxis._usedNeg[tryindex] === undefined) ? 0 : yAxis._usedNeg[tryindex];
						yAxis._usedNeg[tryindex] += dataset.data[i][1];
					}
				}	
			}

			//

		}

		// Determine if this is a numerical axis or not
		if (typeof dataset.data[0][0] === 'string') {
			xAxis.numeric = true;
		}

		// Update axis min/max of axis, last dataset of axis has the control
		if (yAxis.stacked) {
			yAxis._maxVal = yAxis.max !== 'auto' ? yAxis.max : Math.max(Math.max.apply(null, yAxis._usedPos), yAxis._maxVal);
			yAxis._minVal = yAxis.min !== 'auto' ? yAxis.min : Math.min(Math.min.apply(null, yAxis._usedNeg), yAxis._minVal);
		} else {
			yAxis._maxVal = yAxis.max !== 'auto' ? yAxis.max : Math.max(Math.max.apply(null, cleanDataY), yAxis._maxVal);
			yAxis._minVal = yAxis.min !== 'auto' ? yAxis.min : Math.min(Math.min.apply(null, cleanDataY), yAxis._minVal);
		}
		xAxis._maxVal = xAxis.max !== 'auto' ? xAxis.max : Math.max(Math.max.apply(null, cleanDataX), xAxis._maxVal);
		xAxis._minVal = xAxis.min !== 'auto' ? xAxis.min : Math.min(Math.min.apply(null, cleanDataX), xAxis._minVal);

		// Mege unique values of this and previous datasets
		xAxis._values = helpers.array.unique(xAxis._values.concat(cleanDataX));
		yAxis._values = helpers.array.unique(yAxis._values.concat(cleanDataY));

		// Update axis range
		xAxis._range = xAxis._maxVal - xAxis._minVal;
		yAxis._range = yAxis._maxVal - yAxis._minVal;

		// Update axis min step
		dataset.data.sort(function(a, b){return a[0]-b[0];});
		xAxis = this.calcMinStep(xAxis,dataset.data,0);
		yAxis = this.calcMinStep(yAxis,dataset.data,1);
		if (xAxis.numeric !== true) {
			xAxis._step = 1;
			xAxis._steps = xAxis._labels.length - 1;
		} else {
			xAxis = this.calcAxisSteps(xAxis);	
		}

		// Update axis steps
		yAxis = this.calcAxisSteps(yAxis);

		// If type == 'bar', force extra steps on x axis
		if (dataset.type==='bar') {
			xAxis._padded = true;
		}

		// Chain
		return this;
	};

	prot.pushDataset = function (dataset) {
		var d;

		// Reset certain stuff connected to the axises of our new dataset
		this.xAxises[dataset.x.axis]._values = [];
		this.yAxises[dataset.y.axis]._values = [];
		this.xAxises[dataset.x.axis]._labels = [];
		this.yAxises[dataset.y.axis]._labels = [];
		this.yAxises[dataset.y.axis]._usedPos = [];
		this.yAxises[dataset.y.axis]._usedNeg = [];

		// Loop through each dataset that uses these axises, and update the axises
		for( d=0; d<this.datasets.length; d++)  {
			if (this.datasets[d].x.axis === dataset.x.axis || this.datasets[d].y.axis === dataset.y.axis) {
				this.updateAxises(this.datasets[d]);
			}
		}

		this.updateAxises(dataset);
		this.datasets.push(dataset);

		// Chain
		return this;

	};

	prot.calcAxisSteps = function (axis, stepsGoal) {

		// Default goal steps to 15
		stepsGoal = (stepsGoal === undefined) ? 15 : stepsGoal;

		var step, 		msd,
			magnitude, 	power,
			newSteps, 	newRange,
			newStepSize, oldStep;

		step 		= axis._range / (stepsGoal);
		oldStep		= axis._range * axis._minStepPrc;
		magnitude 	= Math.floor(helpers.math.log10(step));
		power 		= Math.pow(10, magnitude);
		msd 		= Math.round(step/power + 0.5);

		if (msd > 5) {		msd = 10; }
		else if (msd > 2) {	msd = 5; }
		else if (msd > 1) {	msd = 2; }
		
		newStepSize 	= msd * power;
		if(newStepSize < oldStep) { newStepSize = oldStep; }
		axis._startMinVal = axis._minVal - (axis._minVal % newStepSize);

		newSteps 		= Math.round(Math.ceil((axis._range) / newStepSize)) ;
		newRange 		= newStepSize * newSteps;
		axis._step 		= newStepSize;
		axis._steps		= newSteps;

		return axis;

	};

	// Calculate the smallest existing step in current axis
	prot.calcMinStep = function (axis,data,xy) {
		var i,minstep = axis._minStepPrc,lpxp,pxp,point;
		for ( i=0; i < data.length; i++) {
			if ((point = data[i])) {
				pxp = (point[xy] - axis._minVal) / (axis._range);	
				if (lpxp !== undefined && (pxp - lpxp) < minstep) {
					minstep = (pxp - lpxp);
				}
				lpxp = pxp;
			}
		}
		axis._minStepPrc = minstep;
		return axis;
	};

	prot.drawAxis = function (context,axis,orientation,primary) {

		var temp, temp2,
			y,
			h, w,
			dir,
			i, k,		// Iterators
			labeldim,
			lwsw, lwsh,	// Local workspace width/height
			lwox, lwoy,	// Local workspace offset x/y
			text,
			mpxpdiff, innerWidth, pad, lr;

		context.lineWidth = 1;
		context.strokeStyle = axis.gridStyle;

		// Rotate workspace, if working on a y axises, 
		h = (orientation==='x') ? this.w : this.h;
		w = (orientation==='x') ? this.h : this.w;
		if (orientation==='x') {
			context.save();
			context.scale(1,-1);						// Flip matrix to make lower left corner 0,0
			context.translate(0,-this.h);				// Move pointer from old 0,0 (upper left corner) to new 0,0 (lower left corner)
			context.translate(0,w);
			context.rotate(-0.5*Math.PI);
			lwsw = this.wsh;
			lwsh = this.wsw;
			lwox = this.woy;
			lwoy = this.wox;
		} else {
			lwsw = this.wsw;
			lwsh = this.wsh;
			lwoy = this.woy;
			lwox = this.wox;
		}

		mpxpdiff = axis._minStepPrc;
		mpxpdiff = mpxpdiff * (lwsw-(mpxpdiff*lwsw*((axis._padded)?1:0)));
		pad = (axis._padded)?mpxpdiff/2:0;
		innerWidth = (lwsw-pad*2);

		// Set font
		context.font = axis.font;

		// Draw grid and ticks, start out from axis _startMinVal and work up from there
		dir=[+Math.abs(axis._step),-Math.abs(axis._step)];
		for(i=0;i<dir.length;i++) {
			
			k=axis._startMinVal;

			while(k<=axis._maxVal && k>=axis._minVal) {

				temp = Math.round( lwox+pad+(k-axis._minVal)/(axis._range)*(innerWidth));

				// Render grid lines
				if (axis.showGridLines) {
					context.beginPath();
					context.moveTo(temp,lwoy);
					context.lineTo(temp,lwoy+lwsh);
					context.strokeStyle = axis.gridStyle;
					context.stroke();
				}

				// Render labels
				if(axis.showLabels) {

					context.save();
					context.beginPath();

					lr = axis.labelRotation+90+((orientation==='y')?90:0);

					if (axis._labels && axis._labels[k] !== undefined) {
						text = axis.labelFormat(axis._labels[k]);	
					} else {
						text = axis.labelFormat(k);	
					}
					
					labeldim = helpers.math.bboxrot(context.measureText(text).width,axis._textSize,lr);

					if (orientation==='y') {
						context.scale(-1,1);
						context.translate(-this.w,0);
						temp2 = w-temp;
					} else {
						temp2 = temp;
					}	

					y = axis._offset+axis._h-labeldim.height/2-(axis.showScale?axis.majorTickHeight+1:0)-2;
					if (!primary) {
						y = h-y;
					}
					
					context.translate(temp2,y);
					context.rotate(lr*helpers.math.degToRad);
					context.translate(-context.measureText(text).width/2,axis._textSize/3);

					context.fillStyle = axis.scaleStyle;
					context.fillText(text,0,0);

					context.restore();
				}

				// Render ticks
				if (axis.showScale) {
					context.beginPath();
					temp2 = axis._offset+axis._h-1;
					if (primary) {
						context.moveTo(temp,temp2);
						context.lineTo(temp,temp2-axis.majorTickHeight);
					} else {
						context.moveTo(temp,h-temp2);
						context.lineTo(temp,h-temp2+axis.majorTickHeight);
					}
					context.strokeStyle = axis.scaleStyle;
					context.stroke();
				}

				k+=dir[i];
			}
		}

		// Render center line
		if (axis.showCenter && axis.center > axis._minVal && axis.center < axis._maxVal) {
			temp = Math.round( lwox+pad+(axis.center-axis._minVal)/(axis._range)*(innerWidth));
			context.beginPath();
			context.moveTo(temp,lwoy);
			context.lineTo(temp,lwoy+lwsh);
			context.strokeStyle = axis.scaleStyle;
			context.stroke();
		}

		// Render scale line
		if (axis.showScale) {
			context.beginPath();
			if (primary) {
				context.moveTo(lwox,axis._offset+axis._h-1);
				context.lineTo(lwox+lwsw,axis._offset+axis._h-1);
			} else {
				context.moveTo(lwox,h-axis._offset-axis._h+1);
				context.lineTo(lwox+lwsw,h-axis._offset-axis._h+1);
			}
			context.strokeStyle = axis.scaleStyle;
			context.stroke();
		}

		// Render names
		if (axis.name) {
			context.font=axis.font;
			context.fillStyle=axis.scaleStyle;
			if (primary) {
				temp = axis._offset+axis._textSize/1.2;
			} else {
				temp = h-axis._offset-axis._textSize/2.2;
			}
			context.save();
			if (orientation==='y') {
				context.scale(1,-1);
				context.translate(0,-this.h);
				temp2 = h-temp+axis._textSize/1.9;
			} else {
				temp2 = temp;
			}
			context.fillText(axis.name,lwox+lwsw/2-context.measureText(axis.name).width/2,temp2);
			context.restore();
		}

		// De-rotate workspace
		if (orientation === 'x') { context.restore(); }

	};

	prot.drawLegend = function(legend, dry) {
		var legendSize = 0,					// Accumulates up to the total width or height of the legend
			maxW = 0,
			curRow = 1,
			rectMargin = 3,					// Space around the series color rectangle
			rowHeight = parseInt(legend.font.split(' ')[0])*1.2,
			additionalSpace = rowHeight,	// Vertical margin for each legend item
			i, lx, textWidth,
			lwoy = this.legend.inside ? this.nwoy  : this.settings.margin,
			lwox = this.legend.inside ? this.wox + 5 : this.settings.margin,
			lwidth = this.legend.inside ? this.wsw : this.w,
			lheight = this.legend.inside ? this.wsh : this.h;

		this.ctx.font = legend.font;

		// Measure total legend size (nned to do this once before drawing anything)

		for (i=0; i<this.datasets.length; i++) {

			// Set series name, if not existing
			if (this.datasets[i].name === undefined) {
				this.datasets[i].name = 'Series ' + (i+1);
			}

			// Measure current entry, different procedure depending on legend location
			if (legend.position === 'bottom' || legend.position === 'top') {
				if (maxW + this.ctx.measureText(this.datasets[i].name).width + additionalSpace + rowHeight > lwidth ) {
					curRow += 1;
					maxW = 0;
				}
				maxW += this.ctx.measureText(this.datasets[i].name).width + additionalSpace + rowHeight;
				legendSize = rowHeight * curRow;
			} else {
				// Determine widest label
				if((textWidth = this.ctx.measureText(this.datasets[i].name).width) > maxW) {
					maxW = textWidth;
				}
				legendSize = maxW + additionalSpace;
			}
		}

		// Draw legend
		if( !dry ) {
			maxW = 0;
			curRow = 1;
			for (i=0; i<this.datasets.length; i++) {

				// Set the same fillStyle and strokeStyle as the actual series, at the legend entry
				this.ctx.fillStyle = this.datasets[i].fillStyle;
				this.ctx.strokeStyle = this.datasets[i].strokeStyle;

				if (legend.position === 'bottom' || legend.position === 'top') {

						// Check if it's time to move on to next row
						if (maxW + this.ctx.measureText(this.datasets[i].name).width + additionalSpace + rowHeight > lwidth ) {
							curRow += 1;
							maxW = 0;
						}
						
						// Calc x position
						lx = (legend.position === 'bottom' ? lheight+lwoy-legendSize : lwoy) + (curRow-1) * rowHeight + rectMargin;

						// Draw rectangle in series color
						this.ctx.fillRect(maxW+lwox,lx, rowHeight-rectMargin*2,rowHeight-rectMargin*2);
						this.ctx.strokeRect(maxW+lwox,lx, rowHeight-rectMargin*2,rowHeight-rectMargin*2);

						// Draw series text
						this.ctx.fillText (this.datasets[i].name,maxW + rowHeight + lwox , lx + rowHeight/1.35 );
						maxW += this.ctx.measureText(this.datasets[i].name).width + additionalSpace + rowHeight;
				} else {

						// (Same comments as above ...)
						lx = (legend.position === 'right' ? lwidth+lwox-legendSize : lwox);
						this.ctx.fillRect(lx, lwoy + (curRow-1) * rowHeight + rectMargin, rowHeight-rectMargin*2,rowHeight-rectMargin*2);
						this.ctx.strokeRect(lx, lwoy + (curRow-1) * rowHeight + rectMargin, rowHeight-rectMargin*2,rowHeight-rectMargin*2);
						this.ctx.fillText (this.datasets[i].name,lx + rowHeight, lwoy + (curRow-1) * rowHeight + rowHeight/1.35);

						// Move to next rows
						curRow += 1;

				}
			}
		}

		return legendSize;
	};

	prot.redraw = function() {

		var a, c,
			d, ds, mw, i, tw, th,
			lh,
			calcAxis = function(axis,ctx,dir) {
				axis._textSize = (axis.font !== undefined) ? parseInt(axis.font.split(' ')[0]) : 0;
				axis._h = 0;
				axis._h += (axis.showScale) ? 1 : 0;				// Add one pixel for scale
				axis._h += (axis.showScale) ? axis.majorTickHeight : 0;	// Add n pixels for major ticks
				axis._h += (axis.name) ? axis._textSize : 0; // Add n pixels for name
				if (axis.showLabels) {
					mw = 0;
					for (i=axis._minVal; i<=axis._maxVal; i+=axis._step) {

						if (axis._labels && axis._labels[i] !== undefined) {
							tw = ctx.measureText(axis.labelFormat(axis._labels[i])).width;
						} else {
							tw = ctx.measureText(axis.labelFormat(i)).width;
						}
						th = axis._textSize;

						// Rot 0 is different in x and y
						tw = helpers.math.bboxrot(tw,th,axis.labelRotation+((dir==='x')?90:0)).width;

						if(tw > mw) { mw = tw; }
					}
					axis._h += mw;
				}
				// To get the label width, we need to loop through them all
				return axis;
			};

		// Reset workspace width, height and offset
		this.wsw = this.w-this.settings.margin*2; this.wsh = this.h-this.settings.margin*2;
		this.wox = this.settings.margin; this.woy = this.settings.margin;
		this.nwox = this.settings.margin; this.nwoy = this.settings.margin;

		// 2. Calculate legend space requirement
		if (this.settings.showLegend && !this.legend.inside) {
			lh = this.drawLegend(this.legend, true) + this.settings.margin;
			if (this.legend.position === 'bottom') {
				this.woy += lh;
				this.wsh -= lh;
			} else if (this.legend.position === 'top') {
				this.nwoy += lh;
				this.wsh -= lh;
			} else if (this.legend.position === 'left') {
				this.wox += lh;
				this.wsw -= lh;
			} else if (this.legend.position === 'right') {
				this.nwox += lh;
				this.wsw -= lh;
			}
		}

		// 3. Calculate axis 'heights', workpace width, and workspace offset
		for (a in this.yAxises) {
			if (this.yAxises.hasOwnProperty(a)) {
				this.yAxises[a] = calcAxis(this.yAxises[a],this.ctx,'y');

				// Reduce workspace width by axis height
				this.wsw -= this.yAxises[a]._h;

				// Add workspace offset if this is a primary axis
				this.yAxises[a]._offset = (a % 2) ? this.wox : this.nwox;
				if (a % 2) 	{ this.wox += this.yAxises[a]._h; }
				else 		{ this.nwox += this.yAxises[a]._h; }
			}
		}
		for (a in this.xAxises) {
			if (this.xAxises.hasOwnProperty(a)) {
				this.xAxises[a] = calcAxis(this.xAxises[a],this.ctx,'x');

				this.wsh -= this.xAxises[a]._h;

				this.xAxises[a]._offset = (a % 2) ? this.woy : this.nwoy;
				if (a % 2) 	{ this.woy += this.xAxises[a]._h; }
				else 		{ this.nwoy += this.xAxises[a]._h;  }
			}
		}
		
		// 1. Setup matrix
		c = this.ctx;
		c.clearRect(0, 0, this.w, this.h);	// Clear workspace

		c.save();							// Save matrix
		c.translate(0.5,0.5);				// Translate 0.5 px i X and Y to get crisp lines
		c.scale(1,-1);						// Flip matrix to make lower left corner 0,0
		c.translate(0,-this.h);				// Move pointer from old 0,0 (upper left corner) to new 0,0 (lower left corner)

		// 4. Draw axises
		for(a in this.yAxises) { if (this.yAxises.hasOwnProperty(a)) { this.drawAxis(c,this.yAxises[a],'x',(a % 2)); }}
		for(a in this.xAxises) { if (this.xAxises.hasOwnProperty(a)) { this.drawAxis(c,this.xAxises[a],'y',(a % 2)); }}

		// 5. Draw datasets (in reverse from added order, to get stacked stuff right)
		for(d=this.datasets.length-1; d>=0; d--) {
			ds = this.datasets[d];
			if (helpers.renderers[ds.type]!==undefined || ds.type === 'area') {

				// Call renderer, first a special case for line and area
				if (ds.type === 'line' || ds.type === 'area') {
					helpers.renderers.line(this, c, ds, this.xAxises[ds.x.axis], this.yAxises[ds.y.axis]);
				// ... then the general fallback
				} else {
					helpers.renderers[ds.type](this, c, ds, this.xAxises[ds.x.axis], this.yAxises[ds.y.axis]);
				}

				if (ds.lineDots) {
					helpers.renderers.scatter(this, c, ds, this.xAxises[ds.x.axis], this.yAxises[ds.y.axis]);
				}

			} else {
				// Missing renderer
				console.error('Grapho: Missing renderer "' + ds.type + '", cannot render dataset.');
			}
		}

		// 6. Restore matrix
		c.restore();

		if (this.settings.showLegend) {
			this.drawLegend(this.legend, false);
		}
	};

	// Handle resize event
	prot.resize = function () {
		if ((this.w = this.container.width) === 'auto') {
			this.w = getComputedStyle(this.dest, null).getPropertyValue('width');
		}
		if ((this.h = this.container.height) === 'auto') {
			this.h = getComputedStyle(this.dest, null).getPropertyValue('height');
		}
		this.canvas.height = this.h = parseInt(this.h);
		this.canvas.width = this.w = parseInt(this.w);
		this.redraw();
		return this;
	};

	// Connect resize event to all available graphos
	window.addEventListener('resize', function () {
		var graph, i = 0;

		while ((graph = graphos[i++])) {
			graph.resize();
		}
	});

	return Grapho;
}));