/**
 * @fileOverview
 * Combine the SWISH components.
 *
 * @version 0.2.0
 * @author Jan Wielemaker, J.Wielemaker@vu.nl
 * @requires jquery
 */

define([ "jquery",
	 "config",
	 "preferences",
	 "history",
	 "modal",
	 "jquery-ui",
	 "splitter",
	 "bootstrap",
	 "pane",
	 "tabbed",
	 "notebook",
	 "navbar",
	 "search",
	 "editor",
	 "query",
	 "runner",
	 "term",
	 "laconic",
	 "d3",
	 "c3"
       ], function($, config, preferences, history, modal) {

preferences.setDefault("semantic-highlighting", true);
preferences.setDefault("emacs-keybinding", false);

(function($) {
  var pluginName = 'swish';

  var defaults = {
    menu: {
      "File":
      { "Save ...": function() {
	  menuBroadcast("save", "as");
	},
	"Info & history ...": function() {
	  menuBroadcast("fileInfo");
	},
	"Open recent": {
	  type: "submenu",
	  action: function(ev) {
	    history.openRecent(ev, $(this).data('document'));
	  },
	  update: history.updateRecentUL
	},
	"Share": "--",
	"Download": function() {
	  menuBroadcast("download");
	},
	"Collaborate ...": function() {
	  $("body").swish('collaborate');
	},
	"Print group": "--",
	"Print ...": function() {
	  $(".prolog-editor").prologEditor('print');
	}
      },
      "Edit":
      { "Clear messages": function() {
	  menuBroadcast("clearMessages");
	},
	"Changes": "--",
	"View changes": function() {
	  menuBroadcast("diff");
	},
	"Revert changes": function() {
	  menuBroadcast("revert");
	},
	"Options": "--",
	"Semantic highlighting": {
	  preference: "semantic-highlighting",
	  type: "checkbox"
	},
	"Emacs Keybinding": {
	  preference: "emacs-keybinding",
	  type: "checkbox",
	  value: "false"
	}
      },
      "Examples": function(navbar, dropdown) {
	$("body").swish('populateExamples', navbar, dropdown);
      },
      "Help":
      { "About ...": function() {
	  menuBroadcast("help", {file:"about.html"});
	},
	"Topics": "--",
	"Help ...": function() {
	  menuBroadcast("help", {file:"help.html"});
	},
	"Runner ...": function() {
	  menuBroadcast("help", {file:"runner.html"});
	},
	"Debugging ...": function() {
	  menuBroadcast("help", {file:"debug.html"});
	},
	"Notebook ...": function() {
	  menuBroadcast("help", {file:"notebook.html"});
	},
	"Background": "--",
	"Limitations ...": function() {
	  menuBroadcast("help", {file:"beware.html"});
	},
	"Caveats ...": function() {
	  menuBroadcast("help", {file:"caveats.html"});
	},
	"Background ...": function() {
	  menuBroadcast("help", {file:"background.html"});
	},
      }
    }
  }; // defaults;


  /** @lends $.fn.swish */
  var methods = {
    /**
     * Initialise SWISH on the page. At this moment, a page can only
     * contain one SWISH application and swish is normally initialised
     * on the body.  This might change.
     * @example $("body").swish();
     * {Object} options
     * {Boolean} options.show_beware If `true`, show a dialogue box
     * telling this is a limited version.
     */
    _init: function(options) {
      swishLogo();
      setupModal();
      setupPanes();
      setupResize();
      $("#search").search();

      options = options||{};
      this.addClass("swish");

      return this.each(function() {
	var elem = $(this);
	var data = {};			/* private data */

	$("#navbar").navbar(defaults.menu);

	var  editor = $(".prolog-editor").prologEditor({save:true});
	data.runner = $(".prolog-runners").prologRunners();
	data.query  = $(".prolog-query").queryEditor(
          { source:   function() {
	      return elem.swish('prologSource');
	    },
	    sourceID: function() {
	      return editor.prologEditor('getSourceID');
	    },
	    examples: elem.swish('examples'),
	    runner:   data.runner,
	  });

	editor.prologEditor('makeCurrent');

	$(".notebook").notebook();

	if ( options.show_beware )
	  menuBroadcast("help", {file:"beware.html", notagain:"beware"});

	elem.data(pluginName, data);	/* store with element */
      });
    },

    /**
     * Trigger a global event in SWISH.  Currently defined events are:
     *
     *   - `help`        -- show a modal help window
     *   - `source`      -- load a new source
     *   - `saveProgram` -- save the current program
     *
     * This method triggers all elements of class
     * `swish-event-receiver`.
     *
     * @param {String} name is the name of the trigger.
     * @param {Object|null} data provides additional data for the event.
     */
    trigger: function(name, data) {
      menuBroadcast(name, data);
      return this;
    },

    /**
     * Play a file from the webstore, loading it through ajax
     * @param {String|Object} options If a string, the name
     * of the file in the web storage
     * @param {String} options.file is the name of the file in the web
     * storage
     * @param {Number} [options.line] is the initial line number
     * @param {RegEx} [options.regex] search to highlight
     * @param {Boolean} [options.showAllMatches] Show other matches on
     * page.
     * @param {Boolean} [options.newTab] if `true`, open the file in
     * a new tab.
     * @param {Boolean} [options.noHistory] if `true`, do not push the
     * new document to the history.
     * @param {Object} [options.prompt] provided for trace events.  Must
     * be used to highlight the Prolog port at the indicated location.
     */
    playFile: function(options) {
      if ( typeof(options) == "string" )
	options = {file:options};

      var existing = this.find(".storage").storage('match', options);
      if ( existing && existing.storage('expose', "Already open") )
	return this;				/* FIXME: go to line */

      var url = config.http.locations.web_storage + options.file;
      $.ajax({ url: url,
	       type: "GET",
	       data: {format: "json"},
	       success: function(reply) {
		 reply.url = url;

		 function copyAttrs(names) {
		   for(var i=0; i<names.length; i++) {
		     var name = names[i];
		     if ( options[name] )
		       reply[name] = options[name];
		   }
		 }

		 copyAttrs([ "line",
			     "regex", "showAllMatches",
			     "newTab", "noHistory",
			     "prompt"
			   ]);

		 menuBroadcast("source", reply);
	       },
	       error: function(jqXHR) {
		 modal.ajaxError(jqXHR);
	       }
	     });

      return this;
    },

    /**
     * Load file from a URL.  This fetches the data from the URL and
     * broadcasts a `"source"` event that is normally picked up by
     * the tabbed pane.
     * @param {Object}   options
     * @param {String}   options.url     URL to load.
     * @param {Integer} [options.line]   Line to go to.
     * @param {Regex}   [options.search] Text searched for.
     */
    playURL: function(options) {
      var existing = this.find(".storage").storage('match', options);

      if ( existing && existing.storage('expose', "Already open") )
	return this;				/* FIXME: go to line */

      $.ajax({ url: options.url,
	       type: "GET",
	       data: {format: "raw"},
	       success: function(source) {
		 var msg = { data: source,
			     url: options.url
			   };

		 function copyAttrs(names) {
		   for(var i=0; i<names.length; i++) {
		     var name = names[i];
		     if ( options[name] )
		       msg[name] = options[name];
		   }
		 }

		 copyAttrs([ "line",
			     "regex", "showAllMatches",
			     "newTab", "noHistory",
			     "prompt"
			   ]);

		 menuBroadcast("source", msg);
	       },
	       error: function(jqXHR) {
		 modal.ajaxError(jqXHR);
	       }
      });
    },

    /**
     * @param {Object} ex
     * @param {String} ex.title is the title of the example
     * @param {String} ex.file is the (file) name of the example
     * @param {String} ex.href is the URL from which to download the
     * program.
     * @returns {Function|String} function that loads an example
     */
    openExampleFunction: function(ex) {
      var swish = this;

      if ( ex.type == "divider" ) {
	return "--";
      } else if ( ex.type == "store" ) {
	return function() {
	  methods.playFile.call(swish, ex.file);
	};
      } else {
	return function() {
	  methods.playURL.call(swish, {url:ex.href});
	};
      }
    },

    /**
     * Populate the examples dropdown of the navigation bar. This
     * menthod is used by the navigation bar initialization.
     * @param {Object} navbar is the navigation bar
     * @param {Object} dropdown is the examples dropdown
     */
    populateExamples: function(navbar, dropdown) {
      var that = this;
      $.ajax(config.http.locations.swish_examples,
	     { dataType: "json",
	       success: function(data) {
		 for(var i=0; i<data.length; i++) {
		   var ex = data[i];
		   var title;
		   var options;

		   if ( ex == "--" || ex.type == "divider" ) {
		     title = "--";
		     options = "--";
		   } else {
		     var name = ex.file || ex.href;
		     title = ex.title;
		     options = that.swish('openExampleFunction', ex);
		     if ( name )
		       options.typeIcon = name.split('.').pop();
		   }

		   $("#navbar").navbar('extendDropdown', dropdown,
				       title, options);
		 }
	       }
	     });
      return this;
    },

    /**
     * pick up all Prolog sources, preparing to execute a query. Currently
     * picks up:
     *
     *   - The `.text()` from all elements that match
     *   `".background.prolog.source"`
     *   - The source of the Prolog editor.  We need some notion of a
     *   _current_ Prolog editor.
     */
    prologSource: function() {
      var list = [];
      var src;

      if ( (src=$(".prolog-editor").prologEditor('getSource', "source")) )
	list.push(src);
      if ( (src=$(".background.prolog.source").text()) )
	list.push(src);

      return list.join("\n\n");
    },

    /**
     * Pick up all breakpoints.  Currently assumes a single source.
     * @param {String} pengineID is the pengine for which to set
     * the breakpoints.
     */
    breakpoints: function(pengineID) {
      return this.find(".prolog-editor")
                 .prologEditor('getBreakpoints', pengineID)||[];
    },

    /**
     * @param {Object} [options]
     * @param {Boolean} [options.active=false] If `true`, only return
     * info on the active tab
     */
    tabData: function(options) {
      options = options||{};
      if ( options.active ) {
	return this.find(".tab-pane.active .storage").storage('getData', options);
      } else {
	return this.find(".storage").storage('getData', options);
      }
    },

    /**
     * Extract examples from `$(".examples.prolog").text()`.  If this
     * does not exist, it returns a function that extracts the examples
     * from the current Prolog source editor.
     * @param {Boolean} [onlyglobal] if `true`, only extract globally
     * listed examples.
     * @returns {Array.String|null|Function}
     */
    examples: function(onlyglobal) {
      var text = $(".examples.prolog").text();

      if ( text ) {
	return $().prologEditor('getExamples', text, false);
      } else if ( onlyglobal != true ) {
	return function() {
	  return $(".prolog-editor").prologEditor('getExamples');
	};
      }
    },

    /**
     * Open TogetherJS after lazy loading.
     */
    collaborate: function() {
      var elem = this;
      $(this).attr("data-end-togetherjs-html", "End collaboration");
      require([ "https://togetherjs.com/togetherjs-min.js"
	      ],
	      function() {
		TogetherJS(elem);
	      });
      return this;
    }
  }; // methods

  /**
   * General actions on SWISH are sent as triggers.  Any part of
   * the interface that is interested in events should add the class
   * `swish-event-receiver` and listen to the events in which it is
   * interested.
   */
  function menuBroadcast(event, data) {
    $(".swish-event-receiver").trigger(event, data);
  }

  /**
   * Turn elements with class `swish-logo` into the SWISH logo.
   */
  function swishLogo() {
    $(".swish-logo")
      .append($.el.b($.el.span({style:"color:darkblue"}, "SWI"),
		     $.el.span({style:"color:maroon"}, "SH")))
      .css("margin-left", "30px")
      .css("font-size", "24px")
      .addClass("navbar-brand");
  }

  /**
   * Setup modal actions.  Subsequently, modal dialogue windows
   * are opened by using the trigger `help`.
   * @example $("body").swish('action', 'help', {file:"about.html"});
   */
  function setupModal() {
    if ( $("#modal").length == 0 ) {
      $("body").append($.el.div({id:"modal"}));
      $("#modal").swishModal();
    }
  }

  /**
   * Setup the panes and allow for resizing them
   */
  function setupPanes() {
    $(".tile").tile();
    $(window).resize(function() { $(".tile").tile('resize'); });
    $('body').on("click", "button.close-pane", function() {
      closePane($(this).parent());
    });
    $(".tabbed").tabbed();
  }

  function setupResize() {
    $(window).resize(function() {
      $(".reactive-size").trigger('reactive-resize');
    });
  }

  /**
   * <Class description>
   *
   * @class swish
   * @tutorial jquery-doc
   * @memberOf $.fn
   * @param {String|Object} [method] Either a method name or the jQuery
   * plugin initialization object.
   * @param [...] Zero or more arguments passed to the jQuery `method`
   */

  $.fn.swish = function(method) {
    if ( methods[method] ) {
      return methods[method]
	.apply(this, Array.prototype.slice.call(arguments, 1));
    } else if ( typeof method === 'object' || !method ) {
      return methods._init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.' + pluginName);
    }
  };
}(jQuery));

}); // define()
