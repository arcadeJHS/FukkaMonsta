angular.module("app", ['ezfb'])
// === Config ===
.config(function ($FBProvider) {
	$FBProvider.setInitParams({
		appId: "489263634517449"
	});  
})
// === Services ===
.service('Friends', function($FB) {
	var f = {
		list: [],
		reset: function() {
			f.list = [];
		},
		get: function() {
			f.reset();
	    	$FB.api({
				method: 'fql.query',
				//query: 'SELECT location, name FROM page WHERE page_id in (SELECT current_location.id from user where uid in(select uid2 from friend where uid1=me()))'
				query: 'SELECT uid, name, current_location FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) and current_location'
			}, 
			function(res) {
				f.list = res;
			});
	    }
	}
    return f;
})
.service('Canvas', function($window, Friends) {
	var c = {
		canvas: null,
		context: null,
		ratio: 1,
		boxWidth: 0,
		boxHeight: 0,
		clear: function() {
			c.context.clearRect(0, 0, c.canvas.width, c.canvas.height);
		},
		court: function() {
			c.canvas.width = $window.innerWidth*c.ratio;
	        c.canvas.height = $window.innerHeight*c.ratio;
	        c.boxWidth = c.canvas.width/36;
	        c.boxHeight = c.canvas.height/16;

	        var	startX = c.canvas.width/2,
	        	startY = c.canvas.height/2,
	        	i = 0,
	        	defaultColor = '#323F4D',
        		centerColor = '#fc0'; 		        

	        for (i = -18; i < 18; i++) {
				c.line({aX:i*c.boxWidth+startX, aY:0, bX:i*c.boxWidth+startX, bY:c.canvas.height, color: (i==0) ? centerColor : defaultColor});
			}
	        for (i = -8; i < 8; i++) {
	        	c.line({aX:0, aY:i*c.boxHeight+startY, bX:c.canvas.width, bY:i*c.boxHeight+startY, color: (i==0) ? centerColor : defaultColor});
			}
		},
		friends: function() {
			var i = 0;
			for (var i = 0; i < Friends.list.length; i++) {
				var	f = Friends.list[i],
					lon = c.canvas.width/2 + ((f.current_location.longitude/10) * c.canvas.width/36),
					lat = c.canvas.height/2 + ((f.current_location.latitude/10*-1) * c.canvas.height/16);
			    c.context.fillStyle = c.randomColor();
				c.context.fillRect(~~(lon+0.5), ~~(lat+0.5), 15, 15);
			}
		},
		line: function(o) {
			c.context.beginPath();
			c.context.moveTo(~~(o.aX+0.5), ~~(o.aY+0.5));
			c.context.lineTo(~~(o.bX+0.5), ~~(o.bY+0.5));
			c.context.lineWidth = ~~(1+0.5);
			c.context.strokeStyle = o.color || '#323F4D';
			("setLineDash" in c.context) && c.context.setLineDash([6]);
			c.context.stroke();
        },
		randomColor: function() {
			var color = '#',
			blocks = "0123456789ABCDEF";
			for (i = 0; i < 3; i++) {color += blocks.substr(Math.random()*blocks.length, 1);}
			return color;
		},
		render: function(canvas) {
			c.canvas = c.canvas || canvas;
			c.context = c.context || canvas.getContext("2d");
			c.clear();
			c.court();
			c.friends();
		},
		move: function(direction) {
			var val = c.canvas.style.left.replace("px", "");
			val = val.length == 0 ? 0 : parseInt(val);
			(direction == "left") && (val -= c.boxWidth);
			(direction == "right") && (val += c.boxWidth);
			c.canvas.style.left = val + "px";
		}
	};
	return c;
})
// === Controllers ===

.controller("commandsController", function($scope, Canvas) {	
	$scope.bigger = function() {
		Canvas.ratio += 0.1;
		Canvas.render();
	};

	$scope.smaller = function() {
		if (Canvas.ratio == 1) return;
		Canvas.ratio -= 0.1;
		Canvas.render();
	};

	$scope.move = function(direction) {
		Canvas.move(direction);
	};
})

// === Directives ===
.directive('mapCanvas', function($window, Canvas) {
	return {
		link: function(scope, elem, attrs) {
			var render = (function renderCanvas() {
			    Canvas.render(elem[0]);
			    return renderCanvas;
			}());

			angular.element($window).bind("resize", render);		    
		},
		controller: function($scope, $element, Friends) {
			$scope.$watch(
				function() {
					return Friends.list;
				},
				function(newValue, oldValue) {
					if(newValue === oldValue) return;
					Canvas.render($element[0]);
				},
				true
			);
		}
	};
})
.directive('navigator', function() {
	return {
		replace: true,
		template: 	'<nav>' +
						'<section id="nav">' +
							'<button ng-click="login()" ng-hide="loginStatus.status == \'connected\'">Connect</button>' +
							'<button ng-click="logout()" ng-hide="!loginStatus || loginStatus.status != \'connected\'">Logout</button>' +
							'<button ng-click="getFriends()" ng-hide="!loginStatus || loginStatus.status != \'connected\'">Get FB Friends</button>' +
							'<a href="#" ng-repeat="f in friends.list">' +
								'<label ng-bind="f.name"></label>' +
								'<label ng-bind="f.current_location.name"></label>' +
								'<label>' +
									'<span ng-bind="f.current_location.longitude"></span>,&nbsp;<span ng-bind="f.current_location.latitude"></span>' +
								'</label>' +
							'</a>' +
						'</section>' +
						'<button id="showNav">|||</button>' +
					'</nav>', 
		link: function(scope, elem, attrs) {
			function hasClass(el, cls) {
				return el.className.match("(^|\\s)" + cls + "(\\s|$)");
			} 

			function addClass(el, cls) {
				if (!hasClass(el, cls)) {el.className += " " + cls;}
			} 

			function removeClass(el, cls) {
				el.className = el.className.replace(new RegExp("(^|\\s)" + cls + "(\\s|$)"), " ");
			} 

			function toggleClass(el, cls) {
				hasClass(el, cls) ? removeClass(el, cls) : addClass(el, cls);
			}

			var nav = document.querySelector('#nav'),
				showNav = document.querySelector('#showNav'),
				body = document.body,
				commands = document.querySelector('#commands');

			addClass(body, "sliding-nav-container");

			angular.element(showNav).bind("click", function() {
				toggleClass(this, 'active');
				toggleClass(body, 'body-nav-open');
				toggleClass(nav, 'nav-open');
				toggleClass(commands, 'nav-open');
			});
		},
		controller: function($scope, $element, $FB, Friends) {
			$scope.friends = Friends;

			$scope.login = function() {
				$FB.login(function(res) {
					if (res.authResponse) {
						updateLoginStatus(updateApiMe);
					}
				},
				// permissions 
				{scope: 'friends_hometown, friends_location'});
			};

			$scope.logout = function() {
				$FB.logout(function() {
					updateLoginStatus(updateApiMe);
				});
				Friends.reset();
			};

			$scope.getFriends = function() {
				Friends.get();
			};
			
			function updateLoginStatus(more) {
				$FB.getLoginStatus(function(res) {
					$scope.loginStatus = res;
					(more || angular.noop)();
				});
			}
			
			function updateApiMe() {
				$FB.api('/me', function(res) {
					$scope.apiMe = res;
				});
			}

			updateLoginStatus(updateApiMe);
		}
	};
});