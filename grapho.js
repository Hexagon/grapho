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

	function isUntypedObject (it) {
		var key;

		if (!it || it.nodeType || it === it.window || toString.call(it) !== '[object Object]') {
			return false;
		}

		try {
			// Not own constructor property must be Object
			if (it.constructor && !it.hasOwnProperty('constructor') && !it.constructor.prototype.hasOwnProperty('isPrototypeOf')) {
				return false;
			}
		} catch (e) {
			return false;
		}

		// Own properties are enumerated firstly, so to speed up, if last one is own, then all properties are own.
		
		// Why empty block? 
		for (key in it) {}

		return key === undef || it.hasOwnProperty(key); // jshint ignore:line
	}

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

	function merge (target, source) {
		var name;

		for (name in source) {
			if (source[name] !== undef) {
				if (target[name] && toString.call(target[name]) === '[object Object]' && isUntypedObject(source[name])) {
					merge(target[name], source[name]);
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
	 * Check that y axis exists, if not, initiate it
	 * @param  {Integer} index Axis index, starting from 1
	 * @return {Object}                `this`
	 */
	prot.initYAxis = function (props) {

		var defaults = {
				min: 'auto',
				max: 'auto',
				minVal: Infinity,
				maxVal: -Infinity,
				center: 0
			},
			index = props.axis;

		if (typeof index === 'number' && isFinite(index) && index % 1 ===0) {

			if (this.yAxises[index] === undef) {

				// Merge properties, if passed
				if (typeof props === 'object') {
					defaults = merge(defaults, props);
				}

				this.yAxises[index] = defaults;

			} else {
				// Merge current with new settings, if passed
				if (typeof props === 'object') {

					defaults = merge(this.yAxises[index], props);
					this.yAxises[index] = defaults;

				}
			}
		}

		// Chain
		return this;
	};

	/**
	 * Check that x axis exists, if not, initiate it
	 * @param  {Integer} index Axis index, starting from 1
	 * @return {Object} `this`
	 */
	prot.initXAxis = function (props) {
		var defaults = {
				min: 'auto',
				max: 'auto',
				continous: false,
				step: Infinity,
				minVal: Infinity,
				maxVal: -Infinity,
				values: []
			},
			index = props.axis;

		if (typeof index === 'number' && isFinite(index) && index % 1 === 0) {
			if (typeof props === 'object') {
				if (this.xAxises[index] === undef) {
					defaults = merge(defaults, props);
				} else {
					defaults = merge(this.xAxises[index], props);
				}
			}

			this.xAxises[index] = defaults;
		}
		
		// ToDo: Merge values

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
		var defaults = {

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

		// `dataset` can be either an array or an object.
		if (datasetIsArray) {
			defaults.data = dataset;
		} else {
			defaults = merge(defaults, dataset);
		}

		// Make sure the axis exists
		this.initYAxis(defaults.y);
		this.initXAxis(defaults.x);

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

		// Sort the unique values
		xAxis.values.sort(function(a, b){return a-b;});

		// Recalculate smallest step
		for (i = 0; i < xAxis.values.length - 1; i++) {
			step = xAxis.values[i + 1] - xAxis.values[i];
			if (step < xAxis.step) {
				xAxis.step = step;
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
		function renderLineArea (ctx, dataset, data, i, to, stop, xAxis, yAxis, min, max, innerHeight, innerWidth, margin) {
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

					pxp = xAxis.continous ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;

					px = round(margin + ((innerWidth-stop) * pxp) + stop / 2);
					py = round(margin + innerHeight - (point[1] - min) / (max - min) * innerHeight);

					if (!i) {
						// Keep track of first pixel, for later use by area charts
						ctx.moveTo((fpx = px), py);
					} else if (dataset.lineSmooth && i < data.length - 1) {
						next = data[i + 1];
						npxp = xAxis.continous ? (next[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([next[0]])) / xAxis.values.length;
						ctx.quadraticCurveTo(
							px, // The x-coordinate of the Bézier control point
							py, // The y-coordinate of the Bézier control point
							(px+(!next ? 0 : round(margin + ((innerWidth-stop) * npxp) + stop / 2))) / 2, // The x-coordinate of the ending point
							(py+(!next ? 0 : round(margin + innerHeight - (next[1] - min) / (max - min) * innerHeight))) / 2 // The y-coordinate of the ending point
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
				cy = round(margin + innerHeight - (yAxis.center - min) / (max - min) * innerHeight);

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
		function renderScatter (ctx, dataset, data, i, to, stop, xAxis, yAxis, min, max, innerHeight, innerWidth, margin) {
			var point, pxp;
				
			for ( ; i < to; i++) {
				// We might need to skip some points that are not in the dataset
				if ((point = data[i])) {
					pxp = xAxis.continous ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;
					ctx.beginPath();
			     	ctx.arc(
			     		round(margin + ((innerWidth-stop) * pxp) + stop/2), // The x-coordinate of the center of the circle
			     		round(margin + innerHeight - ((point[1] - min) / (max - min)) * innerHeight), // The y-coordinate of the center of the circle
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
		function renderBarChart (ctx, dataset, data, i, to, stop, xAxis, yAxis, min, max, innerHeight, innerWidth, margin) {
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

					pxp = xAxis.continous ? (point[0] - xAxis.minVal) / (xAxis.maxVal - xAxis.minVal) : xAxis.values.indexOf(parseFloat([point[0]])) / xAxis.values.length;

					bt = (point[1] <= center) ? center : point[1];
					bb = (point[1] > center) ? center : point[1];
					px = round(margin + barSpacing / 2 + (pxp * innerWidth));
					py = round(margin + innerHeight - (bt - min) / (max - min) * innerHeight);
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
			var i,
				func,
				dataset,
				args = [],
				xAxis,
				yAxis,
				margin;

			// Clear canvas before drawing
			this.ctx.clearRect(0, 0, this.w, this.h);

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
					/* `stop` */		xAxis.continous ? Math.ceil((xAxis.maxVal - xAxis.minVal) / xAxis.step + 1) : xAxis.values.length,
					/* `xAxis` */ 		xAxis,
					/* `yAxis` */ 		yAxis,
					/* `min` */ 		yAxis.minVal,
					/* `max` */ 		yAxis.maxVal,
					/* `innerHeight` */ this.h - margin,
					/* `innerWidth` */ 	this.w - margin,
					/* `margin` */ 		margin
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