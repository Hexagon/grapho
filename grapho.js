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

		// Reasonable defaults for everything
		defaultLabelFormatter = function (l) {
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
		defaults = {
			dataset: {
				type: 'line', // line || scatter || area || bar

				x: { axis: 1 },
				y: { axis: 1 },

				// type: 'line' or 'area'
				lineWidth: 2,
				lineSmooth: true,
				strokeStyle: '#9494BA',
				fillStyle: '#121612',
				lineDots: false,

				// type: scatter || lineDots: true
				dotWidth: 4,

				// type: 'bar'
				barWidthPrc: 80
			},
			axis: {
				min: "auto",
				max: "auto",
				scale: false,
				scaleStyle: '#FFFFFF',
				gridLines: false,
				gridStyle: '#666666',
				name: undefined,
				font: '10px Droid Sans',
				labelFormat: defaultLabelFormatter,
				labels: false,
				majorTickHeight: 4,
				minorTickHeight: 2,
				center: 0,
				padded: false,
				
				// Used internaly
				_textSize: 0,				// Parsed height of font in pixels
				_h: undefined,
				_step: Infinity,
				_steps: 0,
				_minStepPrc: 1,
				_range: 0,
				_minVal: Infinity,
				_maxVal: -Infinity,
				_padded: false, 			// Padding adds a half step to the width, usable for bar charts
				_values: []
				
			}
		},

		// Grapho helper functions
		helpers = {

			// Array helpers
			array: {	
				is: Array.isArray || function (it) {
					return toString.call(it) === '[object Array]';
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

					// Added to always get a true deep copy
					if(recurse === undefined) { 
						target = helpers.object.merge({},target,true);
					}

					var name;
				
					for (name in source) {
						if (source[name] !== undefined) {
							if (target[name] && toString.call(target[name]) === '[object Object]') {
								// Changed to get a true deep copy
								// From:
								//   merge(target[name], source[name])
								// To: 
								target[name] = helpers.object.merge(helpers.object.merge({},target[name]), source[name],true);
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

					mpxpdiff = xAxis._minStepPrc / xAxis._range;
					innerWidth = (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					mpxpdiff = mpxpdiff * grapho.wsw;
					pad = (xAxis._padded)?mpxpdiff/2:0;

					for ( i = 0; i < dataset.data.length; i++) {
						if ((point = dataset.data[i])) {

							pxp = (point[0] - xAxis._minVal) / (xAxis._range);

							px = Math.round(grapho.wox + pad + ((innerWidth) * pxp));
							py = Math.round(grapho.woy + (point[1] - yAxis._minVal) / (yAxis._range) * grapho.wsh);

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

						cy = Math.round(((yAxis.center < yAxis._minVal ? yAxis._minVal : yAxis.center) - yAxis._minVal) / (yAxis._range) * grapho.wsw + grapho.woy)+0.5;

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
				bar: function (grapho, context, dataset, xAxis, yAxis) {
					var point, pxp, pad, mpxpdiff, i,

						barSpacing,
						barWidth,

						px,
						py,
						bh, // Bar height
						ct, // Center temp

						center = yAxis.center;
					
					context.fillStyle = dataset.fillStyle;

					mpxpdiff = xAxis._minStepPrc / xAxis._range;
					innerWidth = (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					mpxpdiff = mpxpdiff * grapho.wsw;
					pad = (xAxis._padded)?mpxpdiff/2:0;

					barSpacing 	= mpxpdiff*(100-dataset.barWidthPrc)/100;
					barWidth 	= mpxpdiff-barSpacing;

					for ( i=0; i < dataset.data.length; i++) {
						// We might need to skip some points that are not in the dataset
						if ((point = dataset.data[i])) {

							pxp = (point[0] - xAxis._minVal) / (xAxis._range);
							
							ct = (center < yAxis._minVal) ? yAxis._minVal : center;
							
							px = Math.round(grapho.wox - mpxpdiff/2 + pad + barSpacing/2 + (pxp * innerWidth));
							py = Math.round(grapho.woy + (((point[1] <= ct) ? ct : point[1]) - yAxis._minVal) / (yAxis._range) * grapho.wsh);
							bh = Math.round(grapho.woy + (((point[1] > ct) ? ct : point[1]) - yAxis._minVal) / (yAxis._range) * grapho.wsh) - py;

							context.fillRect(px, py, barWidth, bh);

						}
					}
				},
				scatter: function (grapho, context, dataset, xAxis, yAxis) {
					var point, pxp, mpxpdiff, pad, i;

					mpxpdiff = xAxis._minStepPrc / xAxis._range;
					innerWidth = (grapho.wsw-(mpxpdiff*grapho.wsw*((xAxis._padded)?1:0)));
					mpxpdiff = mpxpdiff * grapho.wsw;
					pad = (xAxis._padded)?mpxpdiff/2:0;

					for ( i=0; i < dataset.data.length; i++) {
						// We might need to skip some points that are not in the dataset
						if ((point = dataset.data[i])) {
							pxp = (point[0] - xAxis._minVal) / xAxis._range;
							context.beginPath();
					     	context.arc(
					     		Math.round(grapho.wox + pad + ((innerWidth) * pxp)), // The x-coordinate of the center of the circle
					     		Math.round(grapho.woy + ((point[1] - yAxis._minVal) / yAxis._range) * grapho.wsh), // The y-coordinate of the center of the circle
					     		dataset.dotWidth, // The radius of the circle
					     		0, // The starting angle, in radians (0 is at the 3 o'clock position of the arc's circle)
					     		Math.PI * 2 // The ending angle, in radians
					     	);
					     	context.fillStyle = dataset.strokeStyle;
					     	context.fill();
					    }
					}
				}
			},

			// Math helpers
			math: {
				log10: function(x) {
				  return Math.log(x) / Math.LN10;
				},
				isNumber: function(n) {
				  return !isNaN(parseFloat(n)) && isFinite(n);
				},
				isInt: function(n) {
				   return n % 1 === 0;
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
			width: "auto",
			height: "auto"
		};

		// If the user has defined a parent element in the settings object,
		// save it and remove it from the settings so that it won't be merged into `this`.
		if (settings.place) {
			place = settings.place;
			settings.place = undefined;
		}

		// Merge the user settings into `this`
		if (settings) {
			helpers.object.merge(this, settings);
		}
		
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

		// Margin
		this.margin = 5;

		// Call the this.place() method if the user has specified an parent.
		if (place) {
			this.place(place);
		}

		// Init done
		this.done = true;

	}

	// Prototype shortcut, hopefully makes minified code more compact
	prot = Grapho.prototype;

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

		// Make sure the axis exists
		this.initAxis(def.y,this.yAxises);
		this.initAxis(def.x,this.xAxises);

		// Push dataset to axis
		this.pushDataset(def);

		// Redraw, but only if the object is fully initiated
		if (this.done === true) {
			this.redraw();
		}

		// Chain
		return this;
	};

	prot.calcAxisSteps = function (axis, stepsGoal) {

		// Default goal steps to 15
		stepsGoal = (stepsGoal === undefined) ? 15 : stepsGoal;

		var step, 		msd,
			magnitude, 	power,
			newSteps, 	newRange,
			newStepSize;

		step 		= axis._range/(stepsGoal);
		magnitude 	= Math.floor(helpers.math.log10(step));
		power 		= Math.pow(10, magnitude);
		msd 		= Math.round(step/power + 0.5);

		if (msd > 5) 		msd = 10;
		else if (msd > 2) 	msd = 5;
		else if (msd > 1) 	msd = 2;
		
		newStepSize 	= msd * power;
		newSteps 		= Math.round(Math.ceil((axis._range) / newStepSize)) ;
		newRange 		= newStepSize * newSteps;

		axis._maxVal 	= axis._minVal + newRange
		axis._step 		= newStepSize;
		axis._steps		= newSteps;

		return axis;

	};

	prot.calcMinStep = function (axis,data) {
		var i,minstep = Infinity,lpxp,pxp,point;
		for ( i=0; i < data.length; i++) {
			if (point = data[i]) {
				pxp = xAxis.continouos ? (point[0] - axis._minVal) / (axis._range) : axis._values.indexOf(parseFloat([point[0]])) / (axis._values.length - 1);
				if (lpxp !== undef && (pxp - lpxp) < mpxpdiff) {
					mpxpdiff = (pxp - lpxp);
				}
				lpxp = pxp;
			}
		}
		axis._minStepPrc = minstep;
		return axis;
	};

	prot.pushDataset = function (dataset) {
		var yAxis = this.yAxises[dataset.y.axis],
			xAxis = this.xAxises[dataset.x.axis],
			i,
			step,
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
		} else {
			for (i = 0 ; i < datasetLen; i++) {
				cleanDataY[i] = dataset.data[i][1];
				cleanDataX[i] = dataset.data[i][0];
			}
		}

		// Update axis min/max of axis, last dataset of axis has the control
		yAxis._maxVal = yAxis.max !== "auto" ? yAxis.max : Math.max(Math.max.apply(null, cleanDataY), yAxis._maxVal);
		yAxis._minVal = yAxis.min !== "auto" ? yAxis.min : Math.min(Math.min.apply(null, cleanDataY), yAxis._minVal);
		xAxis._maxVal = xAxis.max !== "auto" ? xAxis.max : Math.max(Math.max.apply(null, cleanDataX), xAxis._maxVal);
		xAxis._minVal = xAxis.min !== "auto" ? xAxis.min : Math.min(Math.min.apply(null, cleanDataX), xAxis._minVal);

		// Mege unique values of this and previous datasets
		xAxis._values = helpers.array.unique(xAxis._values.concat(cleanDataX));
		yAxis._values = helpers.array.unique(yAxis._values.concat(cleanDataY));

		// Update axis range
		xAxis._range = xAxis._maxVal - xAxis._minVal;
		yAxis._range = yAxis._maxVal - yAxis._minVal;

		// Update axis steps
		yAxis = this.calcAxisSteps(yAxis); xAxis = this.calcAxisSteps(xAxis);

		// Calculate axis minimum step
		yAxis = this.calcAxisSteps(yAxis); xAxis = this.calcAxisSteps(xAxis);

		// If type == 'bar', force extra steps on x axis
		if (dataset.type==='bar') {
			xAxis._padded = true;
		}

		this.datasets.push(dataset);

		// Chain
		return this;
	};

	prot.drawAxis = function (context,axis,orientation,primary) {

		var temp, temp2,
			x=0, y,
			h, w,
			dir,
			i,
			k,
			lwsw, lwsh,
			lwox, lwoy,
			text;

		context.lineWidth = 1;
		context.strokeStyle = axis.gridStyle;

		// Rotate workspace, if working on a y axises
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

		// Draw grid and ticks
		dir=[+Math.abs(axis._step),-Math.abs(axis._step)];
		for(i=0;i<dir.length;i++) {
			k=0;

			while(k<axis._maxVal && k>=axis._minVal) {
				temp = Math.round( lwox+(k-axis._minVal)/(axis._range)*(lwsw));

				// Render grid lines
				if (axis.gridLines) {
					context.beginPath();
					context.moveTo(temp,lwoy);
					context.lineTo(temp,lwoy+lwsh);
					context.strokeStyle = axis.gridStyle;
					context.stroke();
				}

				// Render labels
				if(axis.labels) {
					context.beginPath();
					if (primary) {
						y = axis._offset+axis._h-axis._textSize/4;
					} else {
						y = h-axis._offset+axis._textSize*1.3;
					}
					text = axis.labelFormat(k);
					context.save();
					if (orientation==='y') {
						context.scale(-1,1);
						context.translate(-this.w,0);
						temp2 = w-temp;
					} else {
						temp2 = temp;
					}
					context.translate(temp2-axis._textSize/3,y-context.measureText(text).width-1-((axis.scale)? axis.majorTickHeight : 0));
					context.rotate(0.5*Math.PI);
					context.fillStyle = axis.scaleStyle;
					context.fillText(text,0,0);
					context.restore();
				}

				// Render ticks
				if (axis.scale) {
					context.beginPath();
					if (primary) {
						context.moveTo(temp,axis._offset+axis._h-1);
						context.lineTo(temp,axis._offset+axis._h-axis.majorTickHeight-1);
					} else {
						context.moveTo(temp,h-axis._offset-axis._h+1);
						context.lineTo(temp,h-axis._offset-axis._h+axis.majorTickHeight+1);
					}
					context.strokeStyle = axis.scaleStyle;
					context.stroke();
				}

				k+=dir[i];
			}
		}

		// Render scale line
		if (axis.scale) {
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

	prot.redraw = function() {

		var a, c,
			d, ds,
			calcAxis = function(axis) {
				if( axis._h === undefined ) {
					axis._textSize = (axis.font !== undefined) ? parseInt(axis.font.split(' ')[0]) : 0;
					axis._h = 0;
					axis._h += (axis.scale) ? 1 : 0;				// Add one pixel for scale
					axis._h += (axis.scale) ? axis.majorTickHeight : 0;	// Add n pixels for major ticks
					axis._h += (axis.labels) ? axis._textSize : 0 // Add n pixels for text
					axis._h += (axis.name) ? axis._textSize : 0 // Add n pixels for name
				}
				return axis;
			};

		// Reset workspace width,height and offset
		this.wsw = this.w-this.margin*2; this.wsh = this.h-this.margin*2;
		this.wox = this.margin; this.woy = this.margin;
		this.nwox = this.margin; this.nwoy = this.margin;

		// 1. Calculate axis "heights", workpace width, and workspace offset
		for(a in this.yAxises) {
			this.yAxises[a] = calcAxis(this.yAxises[a]);

			// Reduce workspace width by axis height
			this.wsw -= this.yAxises[a]._h;

			// Add workspace offset if this is a primary axis
			this.yAxises[a]._offset = (a % 2) ? this.wox : this.nwox;
			if (a % 2) 	this.wox += this.yAxises[a]._h;
			else 		this.nwox += this.yAxises[a]._h;
		}
		for(a in this.xAxises) {
			this.xAxises[a] = calcAxis(this.xAxises[a]);

			this.wsh -= this.xAxises[a]._h;

			this.xAxises[a]._offset = (a % 2) ? this.woy : this.nwoy;
			if (a % 2) 	this.woy += this.xAxises[a]._h;
			else 		this.nwoy += this.xAxises[a]._h;
		}

		// 2. Setup matrix
		c = this.ctx;
		c.clearRect(0, 0, this.w, this.h);	// Clear workspace
		c.save();							// Save matrix
		c.translate(0.5,0.5);				// Translate 0.5 px i X and Y to get crisp lines
		c.scale(1,-1);						// Flip matrix to make lower left corner 0,0
		c.translate(0,-this.h);				// Move pointer from old 0,0 (upper left corner) to new 0,0 (lower left corner)

		// 3. Draw axises
		for(a in this.yAxises) this.drawAxis(c,this.yAxises[a],'x',(a % 2));
		for(a in this.xAxises) this.drawAxis(c,this.xAxises[a],'y',(a % 2));

		// 4. Draw datasets
		for(d in this.datasets) {
			ds = this.datasets[d];
			if (helpers.renderers[ds.type]!==undefined || ds.type == 'area') {

				// Call renderer, first a special case for line and area
				if (ds.type == 'line' || ds.type == 'area') {
					helpers.renderers['line'](this, c, ds, this.xAxises[ds.x.axis], this.yAxises[ds.y.axis]);
					if (ds.lineDots) {
						helpers.renderers['scatter'](this, c, ds, this.xAxises[ds.x.axis], this.yAxises[ds.y.axis]);
					}

				// ... then the general fallback
				} else {
					helpers.renderers[ds.type](this, c, ds, this.xAxises[ds.x.axis], this.yAxises[ds.y.axis])
				}

			} else {
				// Missing renderer
				console.error("Grapho: Missing renderer '" + ds.type + "', cannot render dataset.");
			}
		}

		// 5. Restore matrix
		c.restore();

	};

	// Handle resize event
	prot.resize = function () {
		if ((this.w = this.container.width) === "auto") {
			this.w = getComputedStyle(this.dest, null).getPropertyValue('width');
		}
		if ((this.h = this.container.height) === "auto") {
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