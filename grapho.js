(function (self, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], factory);
	} else {
		// Attaches to the current ctx.
		self.Grapho = factory();
	}
}(this, function () {
	// A collection of all instantiated Grapho's
	var graphos = [],
		undef,
		round = Math.round,
		toString = Object.prototype.toString,
		isArray = Array.isArray || function (it) {
			return toString.call(it) == '[object Array]';
		},
		prot = Grapho.prototype;

	function isUntypedObject (it) {
		var key;

		if (!it || it.nodeType || it == it.window || toString.call(it) !== '[object Object]') {
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
		// for (key in it) {}

		return key === undef || it.hasOwnProperty(key);
	}

	function unique (ain) {
	   var u = {}, a = [];
	   for(var i = 0, l = ain.length; i < l; ++i){
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
	 * @return {Object}                `this`
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

		if (typeof index === 'number' && isFinite(index) && index % 1 ===0) {
			if (this.xAxises[index] === undef) {

				// Merge properties, if passed
				if (typeof props === 'object') {
					defaults = merge(defaults, props);
				}

				this.xAxises[index] = defaults;

			} else {

				// Merge current with new settings, if passed
				if (typeof props === 'object') {

					defaults = merge(this.xAxises[index], props);
					this.xAxises[index] = defaults;

				}
			}
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
		if (this.done === true) this.redraw();

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
			data,
			cleanDataY = [],
			cleanDataX = [];

		// If we got a single element dataset ( [4,3,2,...] , expand it into [ [0,4] , [1,3] , [2,2] , ]
		if ( !isArray(dataset.data[0]) ) {
			for(i=0;i<dataset.data.length;i++) {
				cleanDataY[i] = dataset.data[i];
				cleanDataX[i] = i;
				dataset.data[i] = [i,dataset.data[i]];
			}
		} else {
			for(i=0;i<dataset.data.length;i++) {
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
		for(i=0;i<xAxis.values.length-1;i++) {
			step = xAxis.values[i+1] - xAxis.values[i];
			if( step < xAxis.step ) xAxis.step = step;
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

		// Did we get a string?
		if ( typeof newDestination === 'string' ) {
			newDestination = document.getElementById(newDestination);
		}

		var method = (newDestination && (newDestination.appendChild ? 'appendChild' : 'append'));

		if (method) {
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
		function RenderLineArea (graph, dataset) {
			var i, point, skip_i, lstart, lstop, comp,
				
				data	= dataset.data,
				margin 	= dataset.lineWidth / 2,

				yAxis 	= graph.yAxises[dataset.y.axis],
				xAxis 	= graph.xAxises[dataset.x.axis],

				min 	= yAxis.minVal,
				max 	= yAxis.maxVal,

				x_stops	= xAxis.continous ? Math.ceil((xAxis.maxVal - xAxis.minVal) / xAxis.step + 1) : xAxis.values.length,

				inner_height 	= graph.h - margin,
				inner_width 	= graph.w - margin,

				px, py, cy, npx, npy, fpx, x, y, cpx, cpy, nx, ny, ncpx, ncpy,

				// Shortcuts
				ctx = graph.ctx;	

			ctx.beginPath();

			if (xAxis.continous) {
				lstart = xAxis.minVal;
				lstop = xAxis.maxVal+1;
			} else {
				lstart = 0;
				lstop = xAxis.values.length;
			}
			
			skip_i = xAxis.minVal;
			for(i=lstart;i<lstop;i++) {
				point = data[skip_i];
				comp = (xAxis.continous) ? i : xAxis.values[i];

				// We might need to skip some points that are not in the dataset
				if( point !== undefined && (point[0] === comp)) {

					if (data.continous){
						x = point[0]; 
						nx = data.continous ? (data[skip_i+1] ? data[skip_i+1][0] : 0) : i; 
						cpx = x / lstop; // Current pixel percentage x
						cnpx = nx / lstop ; 
					} else {
						x = i; 
						nx = i+1;
						cpx = x/lstop; // Current pixel percentage x
						cnpx = nx/lstop; 
					}

					y = point[1];
					ny = data[skip_i+1] ? data[skip_i+1][1] : 0;
					cpy = (y - min) / (max - min);	// Current pixel percentage y
					cnpy = (ny - min) / (max - min);	// Current pixel percentage y

					px = round(margin + cpx * inner_width + (inner_width/x_stops/2));	// Pixel x
					py = round(margin + inner_height - cpy * inner_height); // Pixel y

					npx = ( data[skip_i + 1] ) ? round(margin + cnpx * inner_width + (inner_width/x_stops/2)) : 0; // Next pixel x
					npy = ( data[skip_i + 1] ) ? round(margin + inner_height - cnpy * inner_height) : 0; // Next pixel y

					// Keep track of first pixel, for later use by area charts
					if ( skip_i === 0 ) fpx = px;
					if (skip_i === 0) {
						ctx.moveTo(px, py);
					} else if (skip_i < data.length - 2 && dataset.lineSmooth) {
						ctx.quadraticCurveTo(px, py, (px + npx) / 2, (py + npy) / 2);
						//ctx.quadraticCurveTo(px, py, npx, npy);
					} else if (skip_i < data.length - 1 && dataset.lineSmooth) {
						ctx.quadraticCurveTo(px, py, npx, npy);
					} else {
						ctx.lineTo(px, py);
					}

					skip_i++;

				}

			}

			if (dataset.type === 'area' || dataset.type === 'line') {
				ctx.lineWidth = dataset.lineWidth;
				ctx.strokeStyle = dataset.strokeStyle;
				ctx.stroke();
			}

			if (dataset.type === 'area') {
				cy = round(margin + inner_height - (yAxis.center - min) / (max - min) * inner_height); // Center pixel y

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
		function RenderScatter (graph, dataset) {
			var i, point, skip_i, lstart, lstop, comp,
				
				data	= dataset.data,
				margin 	= dataset.lineWidth / 2,

				yAxis 	= graph.yAxises[dataset.y.axis],
				xAxis 	= graph.xAxises[dataset.x.axis],

				min 	= yAxis.minVal,
				max 	= yAxis.maxVal,

				x_stops	= xAxis.continous ? Math.ceil((xAxis.maxVal - xAxis.minVal) / xAxis.step + 1) : xAxis.values.length,

				inner_height 	= graph.h - margin,
				inner_width 	= graph.w - margin,

				x, y, px, py, cy, cpx, cpy,

				// Shortcuts
				ctx = graph.ctx;	

			if (xAxis.continous) {
				lstart = xAxis.minVal;
				lstop = xAxis.maxVal+1;
			} else {
				lstart = 0;
				lstop = xAxis.values.length;
			}
			
			skip_i = xAxis.minVal;
			for(i=lstart;i<lstop;i=i+(xAxis.continous?xAxis.step:1)) {

				point = data[skip_i];
				comp = (xAxis.continous) ? i : xAxis.values[i];

				// We might need to skip some points that are not in the dataset
				if( point !== undefined && ((point[0] === comp) || xAxis.continous)) {

					if (data.continous){
						x = point[0]; 
						cpx = (x - xAxis.minVal)/ (xAxis.maxVal - xAxis.minVal); // Current pixel percentage x
					} else {
						x = i; 
						cpx = x/lstop; // Current pixel percentage x
					}

					y = point[1];
					cpy = (y - min) / (max - min);	// Current pixel percentage y

					px = round(margin + cpx * inner_width + (inner_width/x_stops/2));	// Pixel x
					py = round(margin + inner_height - cpy * inner_height); // Pixel y

					ctx.beginPath();
			     	ctx.arc(px, py, dataset.dotWidth, 0, 2 * Math.PI, false);
			     	ctx.fillStyle = dataset.strokeStyle;
			     	ctx.fill();

			     	skip_i++;
			    }
			}

		}

		/**
		 * Renders a bar chart
		 * @param {Object} graph The Grapho object
		 * @param {Array} dataset The data datasets
		 */
		function RenderBarChart (graph, dataset) {
			var i, point, skip_i, index, lstart, lstop,
				
				data	= dataset.data,
				margin	= 1,

				yAxis 	= graph.yAxises[dataset.y.axis],
				xAxis 	= graph.xAxises[dataset.x.axis],

				min		= yAxis.minVal,
				max		= yAxis.maxVal,
				center	= yAxis.center,

				x_stops	= xAxis.continous ? Math.ceil((xAxis.maxVal - xAxis.minVal) / xAxis.step + 1) : xAxis.values.length,
				
				inner_height 	= graph.h - margin,
				inner_width 	= (graph.w - margin),
				base_width 		= (inner_width / (x_stops)), // This should be divided with the minimum distance between steps
				bar_spacing 	= base_width - (base_width * dataset.barWidthPrc / 100),
				bar_width	 	= base_width - bar_spacing,

				px, bt, bb, py, bh, x, y;

			graph.ctx.fillStyle = dataset.fillStyle;

			if (xAxis.continous) {
				lstart = xAxis.minVal;
				lstop = xAxis.maxVal+1;
			} else {
				lstart = 0;
				lstop = xAxis.values.length;
			}

			skip_i = xAxis.minVal;
			for(i=lstart;i<lstop;i++) {
				point = data[skip_i];
				comp = (xAxis.continous) ? i : xAxis.values[i];

				// We might need to skip some points that are not in the dataset
				if( point !== undefined && (point[0] === comp)) {
					y = point[1];
					x = point[0];

					px = round(margin + bar_spacing / 2 + (inner_width * (x/xAxis.maxVal)));
					bt = (y <= center) ? center : y; // Bar top
					bb = (y > center) ? center : y; // Bar bottom
					py = round(margin + inner_height - (bt - min) / (max - min) * inner_height);
					bh = round(margin + inner_height - (bb - min) / (max - min) * inner_height) - py;

					graph.ctx.fillRect(px, py, bar_width, bh);

					skip_i++;
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
				dataset;

			// Clear canvas before drawing
			this.ctx.clearRect(0, 0, this.w, this.h);

			i = 0;
			while ((dataset = this.datasets[i++])) {
				if (dataset.type === 'bar') {
					RenderBarChart(this, dataset);
				} else if (dataset.type === 'line' || dataset.type === 'area') {
					RenderLineArea(this, dataset);
					if(dataset.lineDots) {
						RenderScatter(this, dataset);
					}
				} else if (dataset.type === 'scatter') {
					RenderScatter(this, dataset);
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