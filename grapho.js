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
		if(recurse === undefined) target = merge({},target,true);

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
			name: undefined,
			font: '10px Droid Sans',
			continouos: true,
			majorTickHeight: 3,
			minorTickHeight: 2,
			gridLines: false,
			step: Infinity,
			minVal: Infinity,
			maxVal: -Infinity,
			center: 0,
			values: []
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
		function renderLineArea (ctx, dataset, data, i, to, stop, xAxis, yAxis, min, max, innerHeight, innerWidth, margin, padding) {
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

					px = round(padding[1] + margin + ((innerWidth-stop) * pxp) + stop / 2);
					py = round(padding[0] + margin + innerHeight - (point[1] - min) / (max - min) * innerHeight);

					if (!i) {
						// Keep track of first pixel, for later use by area charts
						ctx.moveTo((fpx = px), py);
					} else if (dataset.lineSmooth && i < data.length - 1) {
						next = data[i + 1];
						npxp = xAxis.continouos ? (next[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([next[0]])) / xAxis.values.length;
						ctx.quadraticCurveTo(
							px, // The x-coordinate of the Bézier control point
							py, // The y-coordinate of the Bézier control point
							(px+(!next ? 0 : round(padding[1] + margin + ((innerWidth-stop) * npxp) + stop / 2))) / 2, // The x-coordinate of the ending point
							(py+(!next ? 0 : round(padding[0] + margin + innerHeight - (next[1] - min) / (max - min) * innerHeight))) / 2 // The y-coordinate of the ending point
						);
					} else {
						ctx.lineTo(px, py);
					}
				}
			}

			ctx.lineWidth = dataset.lineWidth;
			ctx.strokeStyle = dataset.strokeStyle;
			ctx.stroke();

			if (dataset.type === 'area') {

				cy = round(innerHeight + padding[0] + margin - ((yAxis.center < min ? min : yAxis.center) - min) / (max - min) * innerHeight)-1;

				ctx.lineTo(px, cy); // Move to center at last col
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
		function renderScatter (ctx, dataset, data, i, to, stop, xAxis, yAxis, min, max, innerHeight, innerWidth, margin, padding) {
			var point, pxp;

			for ( ; i < to; i++) {
				// We might need to skip some points that are not in the dataset
				if ((point = data[i])) {
					pxp = xAxis.continouos ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;
					ctx.beginPath();
			     	ctx.arc(
			     		round(padding[1] + margin + ((innerWidth-stop) * pxp) + stop/2), // The x-coordinate of the center of the circle
			     		round(padding[0] + margin + innerHeight - ((point[1] - min) / (max - min)) * innerHeight), // The y-coordinate of the center of the circle
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
		function renderBarChart (ctx, dataset, data, i, to, stop, xAxis, yAxis, min, max, innerHeight, innerWidth, margin, padding) {
			var point, pxp,

				barSpacing 	= (innerWidth / stop)*(100-dataset.barWidthPrc)/100,
				barWidth 	= (innerWidth / stop)-barSpacing,

				px,
				py,
				bt, // Bar top margin
				bb, // Bar bottom margin
				bh, // Bar height

				center = yAxis.center;

			ctx.fillStyle = dataset.fillStyle;
			
			for ( ; i < to; i++) {
				// We might need to skip some points that are not in the dataset
				if ((point = data[i])) {

					pxp = xAxis.continouos ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;

					bt = (point[1] <= center) ? center : point[1];
					bb = (point[1] > center) ? center : point[1];
					px = round(padding[1] + margin + barSpacing / 2 + (pxp * innerWidth));
					py = round(padding[0] + margin + innerHeight - (bt - min) / (max - min) * innerHeight);
					bh = round(margin + innerHeight - (bb - min) / (max - min) * innerHeight) - py;

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
			var i, j, x,
				xSteps, ySteps,
				func,
				dataset,
				args = [],
				xAxis,
				yAxis,
				axis,
				axises,
				margin,
				padding = [], 	// 0 = top, 1 = left, 2 = right, 3 = bottom
				used = [],		// Temprorary storage for space used, same as above
				temp,			// Temporary storage
				text_dimensions;		

			// Clear canvas before drawing
			this.ctx.clearRect(0, 0, this.w, this.h);

			padding[0] = padding[1] = padding[2] = padding[3] = used[0] = used[1] = used[2] = used[3] = 0;

			// Measure space usage on axises, we need to do this before drawing anything
			i = 0;
			while ((dataset = this.datasets[i++])) {
				axises = [[this.yAxises[dataset.y.axis],1,2],[this.xAxises[dataset.x.axis],3,0]];
				for (axis in axises) {
					axis = axises[axis];
					if (axis[0].scale) {
						temp = (axis[0].majorTickHeight > axis[0].minorTickHeight) ? axis[0].majorTickHeight : axis[0].minorTickHeight + 2;
						if (axis[0].axis % 2) 
							padding[axis[1]] += temp;
						else 
							padding[axis[2]] += temp;
					}
					if (axis[0].name) {
						temp = parseInt(axis[0].font.split(' ')[0].replace('px', ''))+2;
						if (axis[0].axis % 2)
							padding[axis[1]] += temp;
						else
							padding[axis[2]] += temp;
					}
				}

			}

			// Now when we know accurately how much space each axis will take, we can begin drawing

			// vvvv DEEERP, experimental, this needs to be refactored vvvv
			i = 0;
			while ((dataset = this.datasets[i++])) {
				yAxis = this.yAxises[dataset.y.axis];
				xAxis = this.xAxises[dataset.x.axis];

				xSteps = xAxis.continouos ? Math.round((xAxis.maxVal - xAxis.minVal) / xAxis.step) : xAxis.values.length;
				ySteps = yAxis.continouos ? Math.round((yAxis.maxVal - yAxis.minVal) / yAxis.step) : yAxis.values.length;

				// Names
				if (xAxis.name) {
					this.ctx.font=xAxis.font;
					temp = parseInt(this.ctx.font.split(' ')[0].replace('px', ''))+2;
					this.ctx.fillStyle='#FFFFFF';
					if (dataset.x.axis % 2) {
						temp = this.h-temp/5-used[3];
						used[3]+=temp;
					} else {
						temp = used[0]+temp/3*2.1;
						used[0]+=temp;
					}
					this.ctx.fillText(xAxis.name,this.w/2-this.ctx.measureText(xAxis.name).width/2,temp);
				}
				if (yAxis.name) {
					this.ctx.font=yAxis.font;
					temp = parseInt(this.ctx.font.split(' ')[0].replace('px', ''))+2;
					this.ctx.fillStyle='#FFFFFF';
					if (dataset.y.axis % 2) {
						temp = used[1]+temp/3*2.1;
						used[1]+=temp;
					} else {
						temp = this.w-temp/5-used[2];
						used[2]+=temp;
					}
					this.ctx.save();
					this.ctx.translate(temp,this.h/2+this.ctx.measureText(yAxis.name).width/2);
					this.ctx.rotate(-0.5*Math.PI);
					this.ctx.fillText(yAxis.name,0,0);
					this.ctx.restore();
				}

				if (xAxis.scale) {
					// Primary X
					if (dataset.x.axis % 2) {
						this.ctx.beginPath();
						this.ctx.moveTo(padding[1],this.h-padding[3]-0.5); // +/-0.5 is for compensating that lines are drawn "in between" pixels by default
						this.ctx.lineTo(this.w-padding[2],this.h-padding[3]+0.5);
						this.ctx.lineWidth = 1;
						this.ctx.strokeStyle = '#FFFFFF';
						this.ctx.stroke();
						for (j=0; j<=xSteps; j++) {
							x = j/xSteps;
							this.ctx.beginPath();
							this.ctx.moveTo(Math.round(padding[1]+1+x*(this.w-padding[1]-padding[2]))+0.5,this.h-padding[3]+0.5);
							this.ctx.lineTo(Math.round(padding[1]+1+x*(this.w-padding[1]-padding[2]))+0.5,this.h-padding[3]+0.5+xAxis.majorTickHeight);
							this.ctx.stroke();
						}

					// Secondary X
					} else {
						this.ctx.beginPath();
						this.ctx.moveTo(padding[1],padding[0]-0.5);
						this.ctx.lineTo(this.w-padding[2],padding[0]+0.5);
						this.ctx.lineWidth = 1;
						this.ctx.strokeStyle = '#FFFFFF';
						this.ctx.stroke();
						for (j=0; j<=xSteps; j++) {
							x = j/xSteps;
							this.ctx.beginPath();
							this.ctx.moveTo(Math.round(padding[1]+1+x*(this.w-padding[1]-padding[2]))+0.5,padding[0]-0.5);
							this.ctx.lineTo(Math.round(padding[1]+1+x*(this.w-padding[1]-padding[2]))+0.5,padding[0]-0.5-xAxis.majorTickHeight);
							this.ctx.stroke();
						}
					}
				}

				if (xAxis.gridLines) {
					this.ctx.lineWidth = 1;
					this.ctx.strokeStyle = '#666666';
					for (j=0; j<=xSteps; j++) {
						x = j/xSteps;
						if (xAxis.scale) {
							this.ctx.beginPath();
							this.ctx.moveTo(Math.round(padding[1]+1+x*(this.w-padding[1]-padding[2]))+0.5,padding[0]+0.5);
							this.ctx.lineTo(Math.round(padding[1]+1+x*(this.w-padding[1]-padding[2]))+0.5,this.h-padding[3]-0.5);
							this.ctx.stroke();
						}
					}
				}

				if (yAxis.scale) {
					if (dataset.y.axis % 2) {
						this.ctx.beginPath();
						this.ctx.moveTo(padding[1]-0.5,padding[0]-0.5);
						this.ctx.lineTo(padding[1]-0.5,this.h-padding[3]);
						this.ctx.lineWidth = 1;
						this.ctx.strokeStyle = '#FFFFFF';
						this.ctx.stroke();
						for (j=0; j<=ySteps; j++) {
							x = j/ySteps;
							if (yAxis.scale) {
								this.ctx.beginPath();
								this.ctx.moveTo(padding[1]-0.5-1,this.h-padding[3]-0.5-x*(this.h-padding[0]-padding[3]));
								this.ctx.lineTo(padding[1]-0.5-1-yAxis.majorTickHeight,this.h-padding[3]-0.5-x*(this.h-padding[0]-padding[3]));
								this.ctx.stroke();
							}
						}
					} else {
						this.ctx.beginPath();
						this.ctx.moveTo(this.w-padding[2]+0.5,padding[0]);
						this.ctx.lineTo(this.w-padding[2]+0.5,this.h-padding[3]+0.5);
						this.ctx.lineWidth = 1;
						this.ctx.strokeStyle = '#FFFFFF';
						this.ctx.stroke();
						for (j=0; j<=ySteps; j++) {
							x = j/ySteps;
							this.ctx.beginPath();
							this.ctx.moveTo(this.w-padding[2]+0.5+1,this.h-padding[3]-0.5-x*(this.h-padding[0]-padding[3]));
							this.ctx.lineTo(this.w-padding[2]+0.5+1+yAxis.majorTickHeight,this.h-padding[3]-0.5-x*(this.h-padding[0]-padding[3]));
							this.ctx.stroke();
						}

					}
				}

				if (yAxis.gridLines) {
					this.ctx.lineWidth = 1;
					this.ctx.strokeStyle = '#666666';
					for (j=0; j<=ySteps; j++) {
						x = j/ySteps;
						if (yAxis.scale) {
							this.ctx.beginPath();
							this.ctx.moveTo(padding[1]+0.5,Math.floor(this.h-padding[3]-x*(this.h-padding[0]-padding[3]))+0.5);
							this.ctx.lineTo(this.w-padding[2]+0.5,Math.floor(this.h-padding[3]-x*(this.h-padding[0]-padding[3]))+0.5);
							this.ctx.stroke();
						}
					}
				}
			}

			// Draw charts
			i = 0;
			while ((dataset = this.datasets[i++])) {

				yAxis = this.yAxises[dataset.y.axis];
				xAxis = this.xAxises[dataset.x.axis];

				margin = (dataset.type === 'bar' ? 1 : dataset.lineWidth / 2);

				if (dataset.type === 'bar') {
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
					/* `stop` */		xAxis.continouos ? Math.ceil((xAxis.maxVal - xAxis.minVal) / xAxis.step) : xAxis.values.length,
					/* `xAxis` */ 		xAxis,
					/* `yAxis` */ 		yAxis,
					/* `min` */ 		yAxis.minVal,
					/* `max` */ 		yAxis.maxVal,
					/* `innerHeight` */ this.h - margin - padding[0] - padding[3],
					/* `innerWidth` */ 	this.w - margin - padding[2] - padding[2],
					/* `margin` */ 		margin,
					/* `padding` */		padding,
				];

				if (func) {
					func.apply(this, args);
				}

				// This function call is annoying c:
				if (dataset.lineDots) {
					renderScatter.apply(this, args);
				}
			}

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