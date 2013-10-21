$(function () {
    'use strict';
    var FRAMERATE = 1000 / 30;
    // Simple little Vector2 class for physics calculations
    var Vector2 = function _Vector2(x, y) {
        this.x = x === undefined ? 0 : x;
        this.y = y === undefined ? 0 : y;
    }
    // Additional functionality to Array, used if you want to treat it like a stack.
    // Returns the last .push()'d entry... well technically just the last entry which hopefully is the last pushed.
    Array.prototype.front = function () {
        return this[this.length - 1];
    };
    // Simple assert function to double check my work when parsing replies.
    // Thanks http://stackoverflow.com/questions/15313418/javascript-assert
    function assert(condition, message) {
        if (!condition) {
            throw message || "Assertion failed";
        }
    }

    var Reply = function _Reply() {
        // Cool trick: Since this is the anonymous object creation form,
        // you can refer to this function's scope by naming it _Reply (not that you need to here)
        this.children = [];

        // This line:
        this.position = new Vector2(Math.random() * Post.prototype.bounds.x, Math.random() * Post.prototype.bounds.y);

        // can likely be replaced by this:
        this.position = new Vector2(Math.random() * Post.bounds.x, Math.random() * Post.bounds.y);
        // if Post's bounds never change. prototype is referenced to grab the original value, but if you
        // never set, say, this.bounds.x = XX in a Post method, you don't need the prototype reference
        this.velocity = new Vector2();
        this.div = jQuery('<div/>')
            .addClass('reply')
            .appendTo('#chatty');
    }
    Reply.prototype.attraction = 0.01;
    Reply.prototype.repulsion = 600;
    Reply.prototype.damping = 0.3;
    Reply.prototype.mass = function () {
        return 1;
    }


    var Post = function _Post() {
        var postRef = this;
        this.position = new Vector2(Math.random() * this.bounds.x, Math.random() * this.bounds.y);
        this.replyList = [];
        this.replyTree = null;
        this.velocity = new Vector2();
        this.isHovered = false;
        this.div = jQuery('<div/>')
            .addClass('post')
            .appendTo('#chatty')
            .click(function (e) {
                postRef.isHovered = false;
                Post.prototype.selectedPost = (postRef.isSelected() ? null : postRef); // a toggle
                e.preventDefault();
            }).mouseenter(function () {
                if (!postRef.selected) { postRef.isHovered = true; }
            }).mouseleave(function () {
                postRef.isHovered = false;
            });
    }
    Post.prototype.bounds = new Vector2(800, 600);
    Post.prototype.baseSize = 8;
    Post.prototype.hoveredSizeMultiplier = 2;
    Post.prototype.selectedSizeMultiplier = 3;
    Post.prototype.baseMass = 1;
    Post.prototype.attraction = 0.01;
    Post.prototype.repulsion = 600;
    Post.prototype.damping = 0.7;
    Post.prototype.selectedPost = null;
    Post.prototype.size = function () {
        var multiplier = (this.isSelected() ? this.selectedSizeMultiplier : (this.isHovered ? this.hoveredSizeMultiplier : 1));
        return this.baseSize * multiplier + Math.sqrt(this.reply_count);
    };
    Post.prototype.mass = function () {
        return this.baseMass + 0.1 * Math.sqrt(this.reply_count);
    };
    Post.prototype.isSelected = function () {
        assert(this !== null);
        return this === this.selectedPost;
    };
    Post.prototype.backgroundColour = function () {
        var bgcolour = "black";
        if (!this.category) {
            bgcolour = "black";
        } else if (this.category === "ontopic") {
            bgcolour = "white";
        } else if (this.category === "offtopic") {
            bgcolour = "lightgrey";
        } else if (this.category === "nws") {
            bgcolour = "red";
        } else if (this.category === "political") {
            bgcolour = "blue";
        } else if (this.category === "stupid") {
            bgcolour = "yellow";
        } else if (this.category === "informative") {
            bgcolour = "green";
        }
        return bgcolour;
    };
    Post.prototype.getOpacity = function () {
        var isSelected = this.isSelected(),
            noneAreSelected = this.selectedPost === null;
        return ((noneAreSelected || isSelected) ? 1.0 : 0.5);
    };
    Post.prototype.update = function (velocity) {
        if (!this.isHovered) { // as long as we aren't mouseovered,
            // move to new position, apply some damping to encourage stabilization,
            this.position.x += velocity.x * this.damping;
            this.position.y += velocity.y * this.damping;

            // and finally ensure we don't go out of bounds.
            if (this.position.x < 0) { this.position.x = 0; this.velocity.x = 0; }
            if (this.position.x > this.bounds.x) { this.position.x = this.bounds.x; this.velocity.x = 0; }
            if (this.position.y < 0) { this.position.y = 0; this.velocity.y = 0; }
            if (this.position.y > this.bounds.y) { this.position.y = this.bounds.y; this.velocity.y = 0; }
        }

        // redraw
        $(this.div).css({
            'top':  this.position.y,
            'left': this.position.x,
            'background-color': this.backgroundColour(),
            'width': this.size(),
            'height': this.size()
        })
            .fadeTo(0, this.getOpacity());

        if (this.isSelected()) {
            this.updateReplies();
        }
        return this;
    };
    Post.prototype.startUpdate = function () {
        if (this.replyList.length === 0) {
            this.threadTree = new WinChattyThread();
            this.threadTree.load(this.updateDone);
        }
    };
    Post.prototype.updateDone = function () {
            var replyList = this.threadTree.selectedPost.replyList;
            replyList.forEach(function (replyA) {
                var netVelocity = new Vector2();
                replyList.forEach(function (replyB) {
                    if (replyA === replyB) {
                        return;
                    }
                    var repulsion = repulseFrom.call(replyA, replyB),
                        attraction = new Vector2();
                    if ($.inArray(replyB, replyA.children) > -1 || $.inArray(replyA, replyB.children) > -1) {
                        attraction = attractTo.call(replyA, replyB);
                    }
                    netVelocity.x += repulsion.x + attraction.x;
                    netVelocity.y += repulsion.y + attraction.y;
                });
                if (replyA === this.threadTree.selectedPost.replyTree) { // if root post
                    replyA.position = this.position;
                } else {
                    replyA.position.x += netVelocity.x * replyA.damping;
                    replyA.position.y += netVelocity.y * replyA.damping;
                }
                $(replyA.div).css({
                    'top':  replyA.position.y,
                    'left': replyA.position.x
                });
            });
        }
    };

    // these generic-ish functions should be able to operate on both replies and posts
    // TOFIX: this can be a helper / util plainObject
    var attractTo = function (that) {
        var attraction = new Vector2();
        attraction.x += this.mass() * this.attraction * (that.position.x - this.position.x);
        attraction.y += this.mass() * this.attraction * (that.position.y - this.position.y);
        return attraction;
    };
    var repulseFrom = function (that) {
        var repulsion = new Vector2(),
            rsq = Math.pow(this.position.x - that.position.x, 2) + Math.pow(this.position.y - that.position.y, 2);
        if (rsq === 0) { rsq = 0.00001; } // careful - don't divide by zero!
        repulsion.x = (this.repulsion * (this.position.x - that.position.x) / rsq);
        repulsion.y = (this.repulsion * (this.position.y - that.position.y) / rsq);
        return repulsion;
    };
    var applyGravity = function () {
        var centerOfGravity = new Vector2(this.bounds.x / 2, this.bounds.y / 2),
            gravity = new Vector2();
        gravity.x = this.attraction * (centerOfGravity.x - this.position.x);
        gravity.y = this.attraction * (centerOfGravity.y - this.position.y);
        return gravity;
    };

    var WinChatty = function(args) {
        this.args = args;
    };
    $.extend(WinChatty.prototype, {
        load: function(addCb) {
            var postArgs = {}, loadRef = this;
            for (var i = 0; i < this.args.length; i++) {
                postArgs['arg' + i] = this.args[i];
            }
            $.post(window.location.protocol + '//winchatty.com/service/json', postArgs,
                function (data) {
                    loadRef.success(data);
                    if (addCb) addCb(data);
                },
            'json').fail(this.failure);
            return this;
        },
        success: function(obj) {
            var outcome = true, that = this;
            if (obj.hasOwnProperty('faultString')) {
                console.error('Server fault occurred: ' + obj.faultString);
                outcome = false;
            }
            if (this.callback && outcome) {
                window.setTimeout(function () {
                    that.callback(obj, outcome);
                }, 100);
            }
            return outcome;
        },
        failure: function (jqXHR, statusText, errorThrown) {
            var errorList = ['POST failed due to error:', jqXHR.status, ':', statusText, '|', errorThrown];
            console.error(errorList.join(' '));
            return false;
        }
    });

    var WinChattyThread = function (args) {
        this.args = args || ["ChattyService.getThreadTree"];
        this.callback = this.threadSuccess;
    };
    WinChattyThread.prototype = new WinChatty();
    $.extend(WinChattyThread.prototype, {
        threadSuccess: function (tree) {
            // http://programmers.stackexchange.com/questions/214227/
            var stack = [], replies = [], root = new Reply();

            $.extend(root, tree.replies[0]);
            stack.push(root);
            for (var i = 1; i < tree.replies.length; i++) { // start at i=1 deliberately to skip root, handled above
                var reply = new Reply(),
                    delta = tree.replies[i].depth - stack.length;
                $.extend(reply, tree.replies[i]);
                if (delta > 0) {
                    stack.push(stack.front().children.front());
                }
                while (delta < 0) {
                    stack.pop();
                    delta++;
                }
                stack.front().children.push(reply); // build the tree
                replies.push(reply); // build the list
            }
            this.selectedPost.replyList = replies;
            this.selectedPost.replyTree = root;
//            Post.prototype.selectedPost.setAttribute('replyList', replies);
//            Post.prototype.selectedPost.setAttribute('replyTree', root);
        },
        selectedPost: {},
    });

    var WinChattyStories = function (args) {
        this.args  = args || ["ChattyService.getStories"];
        this.callback = this.storiesSuccess;
    };
    WinChattyStories.prototype = new WinChatty();
    $.extend(WinChattyStories.prototype, {
        storiesSuccess: function (data) {
            var story = new WinChattyStory(data[0]);
            story.load();
        },
        failure: function (error) {
            window.alert("Failed to access winchatty database: " + error);
        }
    });

    var WinChattyStory = function (story_data) {
        if (story_data === undefined) {
            console.error("A story needs data");
            return false;
        }
        this.story_data = story_data;
        this.args = ["ChattyService.getStory", story_data.story_id, 1];
        this.callback = this.storySuccess;
    };
    $.extend(WinChattyStory.prototype, new WinChatty(), {
        storySuccess: function (story) {
            var posts = [];
            story.threads.forEach(function(thread) {
                var post = $.extend({}, new Post(), thread);
                posts.push(post);
            });
            $('#title').text(this.story_data.title + ": " + story.story_name);
            window.setInterval(function () {
                postCalculationLoop(posts);
            }, FRAMERATE);
        }
    });

    // If debug
    $(window).on("error", function(error) {
        alert(error.message);
    });

//    var WinChatty = {
//        Thread:  WinChattyThread,
//        Stories: WinChattyStories,
//        Story:   WinChattyStory
//    };

    $('#chatty').css({
        "height": Post.prototype.bounds.y,
        "width": Post.prototype.bounds.x
    });

    $('input[name=repulsion]').val(Post.prototype.repulsion);
    $('input[name=attraction]').val(Post.prototype.attraction);
    $('input[name=damping]').val(Post.prototype.damping);
    $('input[name=baseSize]').val(Post.prototype.baseSize);

    $('#controls').submit(function (event) {
        Post.prototype.repulsion = $('input[name=repulsion]').val();
        Post.prototype.attraction = $('input[name=attraction]').val();
        Post.prototype.damping = $('input[name=damping]').val();
        Post.prototype.baseSize = $('input[name=baseSize]').val();
        event.preventDefault();
    });

});
