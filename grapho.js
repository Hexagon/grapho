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

	// A collection of all instantiated Grapho's
	var graphos = [],
		undef,
		round = Math.round,
		toString = Object.prototype.toString,
		isArray = Array.isArray || function (it) {
			return toString.call(it) === '[object Array]';
		},
		prot;

	function unique (ain) {
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

	function merge (target, source, recurse) {

		// Added to always get a true deep copy
		if(recurse === undefined) { 
			target = merge({},target,true);
		}

		var name;
	
		for (name in source) {
			if (source[name] !== undef) {
				if (target[name] && toString.call(target[name]) === '[object Object]') {
					// Changed to get a true deep copy
					// From:
					//   merge(target[name], source[name])
					// To: 
					target[name] = merge(merge({},target[name]), source[name],true);
				} else {
					target[name] = source[name];
				}
			}
		}

		return target;
	}

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

		this.datasetDefaults = {

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
			barWidthPrc: 90

		};

		this.axisDefaults = {
			min: 'auto',
			max: 'auto',
			scale: false,
			scaleStyle: '#FFFFFF',
			gridLines: false,
			gridStyle: '#666666',
			name: undefined,
			font: '10px Droid Sans',
			continouos: true,
			majorTickHeight: 3,
			minorTickHeight: 2,
			step: Infinity,
			minVal: Infinity,
			maxVal: -Infinity,
			center: 0,
			values: [],
			extraSteps: 0,
			_measured: false,	// Used internaly
			_written: false, 	// Used internaly
			
		};

		// If the user has defined a parent element in the settings object,
		// save it and remove it from the settings so that it won't be merged into `this`.
		if (settings.place) {
			place = settings.place;
			settings.place = undef;
		}

		// Merge the user settings into `this`
		if (settings) {
			merge(this, settings);
		}
		
		// These aren't settings but needed properties.
		this.id = graphos.push(this) - 1;

		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.w = 0;
		this.h = 0;
		this.dest = 0;

		// Call the this.place() method if the user has specified an parent.
		if (place) {
			this.place(place);
		}

		// Init done
		this.done = true;
	}

	prot  = Grapho.prototype;

	/**
	 * Check that axis exists, if not, initiate it
	 * @param  {Integer} index Axis index, starting from 1
	 * @return {Object}                `this`
	 */
	prot.initAxis = function (props,dest) {
		var defaults = this.axisDefaults,
			index = props.axis;

		if (typeof index === 'number' && isFinite(index) && index % 1 ===0) {

			if (dest[index] === undef) {

				// Merge properties, if passed
				if (typeof props === 'object') {
					defaults = merge(defaults, props);
				}

				dest[index] = defaults;

			} else {
				// Merge current with new settings, if passed
				if (typeof props === 'object') {

					defaults = merge(dest[index], props);
					dest[index] = defaults;

				}
			}
		}

		// Chain
		return this;
	};

	/**
	 * Add dataset
	 * @param  {Object} dataset object containing data, or pure data array
	 * @return {Object}                `this`
	 */
	prot.addDataset = function (dataset) {
		var datasetIsArray = isArray(dataset);

		// Check that we got some type of valid object as parameter
		if (typeof dataset !== 'object' ) {
			return this;
		} else if (!datasetIsArray && !dataset.data) {
			return this;
		}

		// Define some reasonable defaults for each dataset
		var defaults = this.datasetDefaults;

		// `dataset` can be either an array or an object.
		if (datasetIsArray) {
			defaults.data = dataset;
		} else {
			defaults = merge(defaults, dataset);
		}

		// Make sure the axis exists
		this.initAxis(defaults.y,this.yAxises);
		this.initAxis(defaults.x,this.xAxises);

		// Push dataset to axis
		this.pushDataset(defaults);

		// Redraw, but only if the object is fully initiated
		if (this.done === true) {
			this.redraw();
		}

		// Chain
		return this;
	};

	/**
	 * Push finished datasets object to axis
	 * @param  {Object} datasets object containing data, or pure data array
	 * @return {Object}                `this`
	 */
	prot.pushDataset = function (dataset) {
		var yAxis = this.yAxises[dataset.y.axis],
			xAxis = this.xAxises[dataset.x.axis],
			i,
			step,
			datasetLen = dataset.data.length,
			cleanDataY = [],
			cleanDataX = [];

		// If we got a single element dataset ( [4,3,2,...] , expand it into [ [0,4] , [1,3] , [2,2] , ]
		if (!isArray(dataset.data[0])) {
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
		yAxis.maxVal = yAxis.max !== 'auto' ? yAxis.max : Math.max(Math.max.apply(null, cleanDataY), yAxis.maxVal);
		yAxis.minVal = yAxis.min !== 'auto' ? yAxis.min : Math.min(Math.min.apply(null, cleanDataY), yAxis.minVal);
		xAxis.maxVal = xAxis.max !== 'auto' ? xAxis.max : Math.max(Math.max.apply(null, cleanDataX), xAxis.maxVal);
		xAxis.minVal = xAxis.min !== 'auto' ? xAxis.min : Math.min(Math.min.apply(null, cleanDataX), xAxis.minVal);

		// Mege unique values of this and previous datasets
		xAxis.values = unique(xAxis.values.concat(cleanDataX));
		yAxis.values = unique(yAxis.values.concat(cleanDataY));

		// Sort the unique values
		xAxis.values.sort(function(a, b){return a-b;});
		yAxis.values.sort(function(a, b){return a-b;});

		// Recalculate smallest step
		for (i = 0; i < xAxis.values.length - 1; i++) {
			step = xAxis.values[i + 1] - xAxis.values[i];
			if (step < xAxis.step) {
				xAxis.step = step;
			}
		}

		// Recalculate smallest step
		for (i = 0; i < yAxis.values.length - 1; i++) {
			step = yAxis.values[i + 1] - yAxis.values[i];
			if (step < yAxis.step) {
				yAxis.step = step;
			}
		}

		// If type == 'bar', force extra steps on x axis
		if (dataset.type=='bar' && xAxis.extraSteps < 1) xAxis.extraSteps = 1;

		this.datasets.push(dataset);

		// Chain
		return this;
	};

	/**
	 * Moves
	 * @param  {Element} newDestination Destination element
	 * @return {Object}                `this`
	 */
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

	/**
	 * Remove this graph from the current destination
	 * @return {Object} `this`.
	 */
	prot.remove = function () {
		if (this.container.width === 'auto' || this.container.height === 'auto') {
			window.removeEventListener('resize', this.resize);
		}

		// ToDo, remove actual element
		this.canvas.parentElement.removeChild(this.canvas);

		return this;
	};

	/**
	 * Redraws the canvas
	 * @return {Object} `this`.
	 */
	prot.redraw = (function () {

		/**
		 * Renders Line and Area chart
		 * @param {Object} graph The Grapho object
		 * @param {Array} dataset The data datasets
		 */
		function renderLineArea (ctx, dataset, data, i, to, stop, pad, xAxis, yAxis, min, max, innerHeight, innerWidth, padding) {
			var point,
				
				next, npxp,

				px, // Current X-pixel
				py, // Current Y-pixel
				cy, // Center Y-pixel
				fpx, // First X-pixel
				pxp; // Pixel percentage

			ctx.beginPath();

			for ( ; i < to; i++) {
				if ((point = data[i])) {

					pxp = xAxis.continouos ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;

					px = round(padding[1] + pad + ((innerWidth) * pxp));
					py = round(padding[0] + innerHeight - (point[1] - min) / (max - min) * innerHeight);

					if (!i) {
						// Keep track of first pixel, for later use by area charts
						ctx.moveTo((fpx = px+1), py);
					} else if (dataset.lineSmooth && i < data.length - 1) {
						next = data[i + 1];
						npxp = xAxis.continouos ? (next[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([next[0]])) / xAxis.values.length;
						ctx.quadraticCurveTo(
							px, // The x-coordinate of the Bézier control point
							py, // The y-coordinate of the Bézier control point
							(px+(!next ? 0 : round(padding[1] + pad + ((innerWidth) * npxp)))) / 2, // The x-coordinate of the ending point
							(py+(!next ? 0 : round(padding[0] + innerHeight - (next[1] - min) / (max - min) * innerHeight))) / 2 // The y-coordinate of the ending point
						);
					} else {
						ctx.lineTo(px-1, py);
					}
				}
			}

			ctx.lineWidth = dataset.lineWidth;
			ctx.strokeStyle = dataset.strokeStyle;
			ctx.stroke();

			if (dataset.type === 'area') {

				cy = round(innerHeight + padding[0] - ((yAxis.center < min ? min : yAxis.center) - min) / (max - min) * innerHeight)-1;

				ctx.lineTo(px-1, cy); // Move to center at last col
				ctx.lineTo(fpx, cy); // Move to center at first col

				// Empty stroke, as we just want to move the cursor
				ctx.strokeStyle = 'rgba(0,0,0,0)';
				ctx.stroke();

				// Fill the area
				ctx.fillStyle = dataset.fillStyle;	
				ctx.fill();
			}
		}

		/**
		 * Renders Line and Area chart
		 * @param {Object} graph The Grapho object
		 * @param {Array} dataset The data datasets
		 */
		function renderScatter (ctx, dataset, data, i, to, stop, pad, xAxis, yAxis, min, max, innerHeight, innerWidth, padding) {
			var point, pxp;

			for ( ; i < to; i++) {
				// We might need to skip some points that are not in the dataset
				if ((point = data[i])) {
					pxp = xAxis.continouos ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;
					ctx.beginPath();
			     	ctx.arc(
			     		round(padding[1] + pad + ((innerWidth) * pxp)), // The x-coordinate of the center of the circle
			     		round(padding[0] + innerHeight - ((point[1] - min) / (max - min)) * innerHeight), // The y-coordinate of the center of the circle
			     		dataset.dotWidth, // The radius of the circle
			     		0, // The starting angle, in radians (0 is at the 3 o'clock position of the arc's circle)
			     		Math.PI * 2 // The ending angle, in radians
			     	);
			     	ctx.fillStyle = dataset.strokeStyle;
			     	ctx.fill();
			    }
			}
		}

		/**
		 * Renders a bar chart
		 * @param {Object} graph The Grapho object
		 * @param {Array} dataset The data datasets
		 */
		function renderBarChart (ctx, dataset, data, i, to, stop, pad, xAxis, yAxis, min, max, innerHeight, innerWidth, padding) {
			var point, pxp,

				barSpacing 	= stop*(100-dataset.barWidthPrc)/100,
				barWidth 	= stop-barSpacing,

				px,
				py,
				bh, // Bar height

				center = yAxis.center;

			
			ctx.fillStyle = dataset.fillStyle;
			
			for ( ; i < to; i++) {
				// We might need to skip some points that are not in the dataset
				if ((point = data[i])) {

					pxp = xAxis.continouos ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;

					px = round(padding[1] + pad - stop/2 + barSpacing/2 + (pxp * innerWidth));
					py = round(padding[0] + innerHeight - (((point[1] <= center) ? center : point[1]) - min) / (max - min) * innerHeight);
					bh = round(innerHeight - (((point[1] > center) ? center : point[1]) - min) / (max - min) * innerHeight) - py + padding[0];
					if (py-padding[0]+bh > innerHeight) bh = innerHeight-py+padding[0];

					ctx.fillRect(px, py, barWidth, bh);
				}
			}
		}

		/**
		 * The front `redraw` methods.
		 * Calls the appropriate private rendering function.
		 * @return {Object} `this`
		 */
		return function () {
			var i, j, x, k,
				xSteps, ySteps, steps, h, w,
				func,
				dataset,
				args = [],
				xAxis,
				yAxis,
				axis,
				axises,
				margin = 4,
				padding = [], 	// 0 = top, 1 = left, 2 = right, 3 = bottom
				used = [],		// Temprorary storage for space used, same as above
				temp;			// Temporary storage

			// Clear canvas before drawing
			this.ctx.clearRect(0, 0, this.w, this.h);

			padding[0] = padding[1] = padding[2] = padding[3] = used[0] = used[1] = used[2] = used[3] = margin;

			// Save matrix and transform 0.5px in boh x and y to draw everything pixel perfect
			this.ctx.save();
			this.ctx.translate(0.5,0.5);

			for(xAxis in this.xAxises) {
				xAxis = this.xAxises[xAxis];
				xAxis._measured = false;
				xAxis._written = false;
			}
			for(yAxis in this.yAxises) {
				yAxis = this.yAxises[yAxis];
				yAxis._measured = false;
				yAxis._written = false;
			}

			// Measure space usage on axises, we need to do this before drawing anything
			i = 0;
			while ((dataset = this.datasets[i++])) {
				axises = [[this.yAxises[dataset.y.axis],1,2],[this.xAxises[dataset.x.axis],3,0]];
				for (j = 0; j < axises.length; j++) {
					axis = axises[j];

					if (!axis[0]._measured) {
						// Add some pre axis space ( margin )
						if (axis[0].axis % 2) {
							padding[axis[1]] += margin;
						} else {
							padding[axis[2]] += margin;
						}

						if (axis[0].scale) {
							temp = axis[0].majorTickHeight;
							if (axis[0].axis % 2) {
								padding[axis[1]] += temp;
							} else {
								padding[axis[2]] += temp;
							}
						}
						if (axis[0].name) {
							temp = parseInt(axis[0].font.split(' ')[0]);
							if (axis[0].axis % 2) {
								padding[axis[1]] += temp;
							} else {
								padding[axis[2]] += temp;
							}
						}
						axis[0]._measured=true;
					}
				}
			}

			// Now when we know accurately how much space each axis will take, we can begin drawing
			i = 0;
			while ((dataset = this.datasets[i++])) {
				// Array of Axis,left padding idx, right padding idx and wether to rotate
				axises = [[this.yAxises[dataset.y.axis],1,2,3,0,true],[this.xAxises[dataset.x.axis],3,0,1,2,false]];
				for (j=0; j<axises.length;j++) {
					axis = axises[j];

					if (!axis[0]._written) {

						steps = (axis[0].continouos ? Math.ceil((axis[0].maxVal - axis[0].minVal) / axis[0].step) : axis[0].values.length) + axis[0].extraSteps * 2;

						h = (j===0) ? this.w : this.h;
						w = (j===0) ? this.h : this.w;

						// Rotate workspace, if working on a y axises
						if( axis[5] ) {
							this.ctx.save();
							this.ctx.translate(0,w);
							this.ctx.rotate(-0.5*Math.PI);
						}
						// Add some pre axis space (margin)
						if (((axis[0].axis % 2) && axis[5]) || (axis[0].axis % 2) && !axis[5]) {
							used[axis[1]]+=margin;
						} else {
							used[axis[2]]+=margin;
						}

						if (axis[0].name) {
							this.ctx.font=axis[0].font;
							temp = parseInt(this.ctx.font.split(' ')[0]);
							this.ctx.fillStyle=axis[0].scaleStyle;
							if (axis[5]) {
								if ((!(axis[0].axis % 2) && axis[5]) || (axis[0].axis % 2) && !axis[5]) {
									used[axis[2]]+=temp;
									temp = h-used[axis[2]]+temp/1.3;
								} else {
									used[axis[1]]+=temp;
									temp = used[axis[1]]-temp/4;
								}
							} else {
								if ((!(axis[0].axis % 2) && axis[5]) || (axis[0].axis % 2) && !axis[5]) {
									used[axis[1]]+=temp;
									temp = h-used[axis[1]]+temp/1.3;
								} else {
									used[axis[2]]+=temp;
									temp = used[axis[2]]-temp/4;
								}
							}
							this.ctx.fillText(axis[0].name,w/2-this.ctx.measureText(axis[0].name).width/2,temp);
						}

						if (axis[0].gridLines) {
							this.ctx.lineWidth = 1;
							this.ctx.strokeStyle = axis[0].gridStyle;
							for (k=0; k<steps; k++) {
								x = k/steps;
								// Prevent grid lines from overriding scales
								if(x != 0 && x != 1) {
									this.ctx.beginPath();
									if ((!(axis[0].axis % 2) && axis[5]) || (axis[0].axis % 2) && !axis[5]) {
										this.ctx.moveTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),padding[axis[2]]);
										this.ctx.lineTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),h-padding[axis[1]]);
									} else {
										this.ctx.moveTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),padding[axis[1]]);
										this.ctx.lineTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),h-padding[axis[2]]);
									}
									this.ctx.stroke();
								}
							}
						}

						if (axis[0].scale) {

							// Base scale
							this.ctx.beginPath();
							if (axis[5]) {
								if((axis[0].axis % 2)) {
									used[axis[1]]+=axis[0].majorTickHeight;
									this.ctx.moveTo(padding[axis[3]],used[axis[1]]);
									this.ctx.lineTo(w-padding[axis[4]],used[axis[1]]);
								} else {
									used[axis[2]]+=axis[0].majorTickHeight;
									this.ctx.moveTo(padding[axis[3]],h-used[axis[2]]);
									this.ctx.lineTo(w-padding[axis[4]],h-used[axis[2]]);
								}
							} else {
								if((axis[0].axis % 2)) {
									used[axis[1]]+=axis[0].majorTickHeight;
									this.ctx.moveTo(padding[axis[3]],h-used[axis[1]]); 
									this.ctx.lineTo(w-padding[axis[4]],h-used[axis[1]]);
								} else {
									used[axis[2]]+=axis[0].majorTickHeight;
									this.ctx.moveTo(padding[axis[3]],used[axis[2]]);
									this.ctx.lineTo(w-padding[axis[4]],used[axis[2]]);
								}
							}
							this.ctx.lineWidth = 1;
							this.ctx.strokeStyle = axis[0].scaleStyle;
							this.ctx.stroke();

							// Center line
							if ((axis[0].center > axis[0].minVal && axis[0].center < axis[0].maxVal) && axis[0].scale ) {
								this.ctx.beginPath();
								temp = ((axis[0].center- axis[0].minVal) / (axis[0].maxVal - axis[0].minVal));	// Calculate center line position in "y"
								if ((!(axis[0].axis % 2) && axis[5]) || (axis[0].axis % 2) && !axis[5]) {
									this.ctx.moveTo(Math.round(padding[axis[3]]+temp*(w-padding[axis[3]]-padding[axis[4]])),padding[axis[2]]);
									this.ctx.lineTo(Math.round(padding[axis[3]]+temp*(w-padding[axis[3]]-padding[axis[4]])),h-padding[axis[1]]);
								} else {
									this.ctx.moveTo(Math.round(padding[axis[3]]+temp*(w-padding[axis[3]]-padding[axis[4]])),padding[axis[1]]);
									this.ctx.lineTo(Math.round(padding[axis[3]]+temp*(w-padding[axis[3]]-padding[axis[4]])),h-padding[axis[2]]);
								}
								this.ctx.lineWidth = 1;
								this.ctx.strokeStyle = axis[0].scaleStyle;
								this.ctx.stroke();
							}

							// Ticks
							for (k=0; k<steps; k++) {
								x = k/steps;
								this.ctx.beginPath();
								if (axis[5]) {
									if((axis[0].axis % 2)) {
										this.ctx.moveTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),used[axis[1]]);
										this.ctx.lineTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),used[axis[1]]-axis[0].majorTickHeight);
									} else {
										this.ctx.moveTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),h-used[axis[2]]);
										this.ctx.lineTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),h-used[axis[2]]+axis[0].majorTickHeight);
									}
								} else {
									if((axis[0].axis % 2)) {
										this.ctx.moveTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),h-used[axis[1]]);
										this.ctx.lineTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),h-used[axis[1]]+axis[0].majorTickHeight);
									} else {
										this.ctx.moveTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),used[axis[2]]);
										this.ctx.lineTo(Math.round(padding[axis[3]]+x*(w-padding[axis[3]]-padding[axis[4]])),used[axis[2]]-axis[0].majorTickHeight);
									}
								}
								this.ctx.lineWidth = 1;
								this.ctx.strokeStyle = axis[0].scaleStyle;
								this.ctx.stroke();
							}
						}

						// De-rotate workspace
						if (axis[5]) { this.ctx.restore(); }

						axis[0]._written=true;
					}
				}
			}

			// Draw charts
			i = 0;
			while ((dataset = this.datasets[i++])) {

				yAxis = this.yAxises[dataset.y.axis];
				xAxis = this.xAxises[dataset.x.axis];

				steps = xAxis.continouos ? Math.ceil((xAxis.maxVal - xAxis.minVal) / xAxis.step) + axis[0].extraSteps * 2 : xAxis.values.length + axis[0].extraSteps * 2;
				temp = (this.w - padding[1] - padding[2]) - ((this.w - padding[1] - padding[2]) / (steps) * (steps- axis[0].extraSteps * 2));

				if (dataset.type === 'bar') {
					// Temporarily "restore" matrix
					this.ctx.save();
					this.ctx.translate(-0.5,-0.5);
					func = renderBarChart;
				} else if (dataset.type === 'line' || dataset.type === 'area') {
					func = renderLineArea;
				}else if (dataset.type === 'scatter') {
					func = renderScatter;
				}

				args = [
					/* `ctx` */	 		this.ctx,
					/* `dataset` */ 	dataset,
					/* `data` */	 	dataset.data,
					/* `i` */ 			0,
					/* `to` */ 			dataset.data.length,
					/* `stop` */		(this.w - padding[1] - padding[2]) / steps,
					/* `pad` */			temp/2,
					/* `xAxis` */ 		xAxis,
					/* `yAxis` */ 		yAxis,
					/* `min` */ 		yAxis.minVal,
					/* `max` */ 		yAxis.maxVal,
					/* `innerHeight` */ this.h - padding[0] - padding[3],
					/* `innerWidth` */ 	this.w - padding[1] - padding[2] - temp,
					/* `padding` */		padding,
				];

				if (func) {
					func.apply(this, args);
					if (dataset.type === 'bar') {
						// "Unrestore" matrix
						this.ctx.restore();
					}
				}

				// This function call is annoying c:
				if (dataset.lineDots) {
					renderScatter.apply(this, args);
				}
			}

			this.ctx.restore();

			return this;
		};
	}());

	/**
	 * Something something
	 * @return {Object} `this`.
	 */
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

	// Connect resize event in case of
	window.addEventListener('resize', function () {
		var graph, i = 0;

		while ((graph = graphos[i++])) {
			graph.resize();
		}
	});

	return Grapho;
}));