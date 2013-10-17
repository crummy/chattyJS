$(function () {
    var framerate = 1000 / 30;

    // Simple little Vector2 class for physics calculations
    function Vector2(x, y) {
        this.x = x;
        this.y = y;
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

    // Applies a force-based calculation to every post.
    // mostly thanks to http://blog.ivank.net/force-based-graph-drawing-in-as3.html
    function forceCalculationLoop(posts) {
        posts.forEach(function (postA) {
            var netVelocity = new Vector2(0 ,0);
            posts.forEach(function(postB) {
                if (postA === postB) {
                    return; // no need to compare a node to itself
                }
                var repulsion = repulseFrom.call(postA, postB),
                    attraction = new Vector2(0, 0),
                    gravity = applyGravity.call(postA, postB);
                if (postA.data.category === postB.data.category) {
                    attraction = attractTo.call(postA, postB);
                }
                netVelocity.x += repulsion.x + attraction.x + gravity.x;
                netVelocity.y += repulsion.y + attraction.y + gravity.y;
            });
            postA.update(netVelocity);
        });
    };

    // client for winchatty API. used to get chatty title, post data
    // browse winchatty here: http://winchatty.com/service/browser/
    // thanks electroly!
    function winchatty(args, success, failure) {
        var postArgs = {},
            i;
        for (i = 0; i < args.length; i++) {
            postArgs['arg' + i] = args[i];
        }
        $.ajax({
            url:      'http://winchatty.com/service/json',
            type:     'POST',
            data:     postArgs,
            dataType: 'json',
            cache:    false,
            success:  function (data, textStatus, jqXHR) {
                if (data.hasOwnProperty('faultString')) {
                    failure(data.faultString);
                } else {
                    success(data);
                }
            },
            error:    function (jqXHR, textStatus, errorThrown) {
                failure('Failed to call ' + args[0]);
            }
        });
    }

    function Post(data) {
        var postRef = this;
        this.replyList = null;
        this.replyTree = null;
        this.data = data;
        this.position = new Vector2(Math.random() * this.bounds.x, Math.random() * this.bounds.y);
        this.velocity = new Vector2(0, 0);
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
        return this.baseSize * multiplier + Math.sqrt(this.data.reply_count);
    };
    Post.prototype.mass = function () {
        return this.baseMass + 0.1 * Math.sqrt(this.data.reply_count);
    };
    Post.prototype.isSelected = function () {
        assert(this !== null);
        return this === this.selectedPost;
    };
    Post.prototype.backgroundColour = function () {
        var bgcolour = "black";
        if (!this.data) {
            bgcolour = "black";
        } else if (this.data.category === "ontopic") {
            bgcolour = "white";
        } else if (this.data.category === "offtopic") {
            bgcolour = "lightgrey";
        } else if (this.data.category === "nws") {
            bgcolour = "red";
        } else if (this.data.category === "political") {
            bgcolour = "blue";
        } else if (this.data.category === "stupid") {
            bgcolour = "yellow";
        } else if (this.data.category === "informative") {
            bgcolour = "green";
        }
        return bgcolour;
    };
    Post.prototype.getOpacity = function () {
        var isSelected = this.isSelected(),
            noneAreSelected = this.selectedPost === null;
        return ((noneAreSelected || isSelected) ? 1.0 : 0.5);
    };
    var attractTo = function (that) {
        var attraction = new Vector2(0, 0);
        if (this.constructor == Post) {
            attraction.x += this.mass() * this.attraction * (that.position.x - this.position.x);
            attraction.y += this.mass() * this.attraction * (that.position.y - this.position.y);
        } else {
            attraction.x += this.attraction * (that.position.x - this.position.x);
            attraction.y += this.attraction * (that.position.y - this.position.y);
        }
        return attraction;
    };
    var repulseFrom = function (that) {
        var repulsion = new Vector2(0, 0),
            rsq = Math.pow(this.position.x - that.position.x, 2) + Math.pow(this.position.y - that.position.y, 2);
        if (this.constructor === Post) {
            if (rsq === 0) { rsq = 0.00001; } // careful - don't divide by zero!
            if (this.isSelected()) { return repulsion; } // returning no repulsion should send cell to about the center
            repulsion.x = (this.repulsion * (this.position.x - that.position.x) / rsq);
            repulsion.y = (this.repulsion * (this.position.y - that.position.y) / rsq);
            return repulsion;
        } else {
            if (rsq === 0) { rsq = 0.00001; } // careful - don't divide by zero!
            repulsion.x = (this.repulsion * (this.position.x - that.position.x) / rsq);
            repulsion.y = (this.repulsion * (this.position.y - that.position.y) / rsq);
            return repulsion;
        }
    };
    var applyGravity = function () {
        var centerOfGravity = new Vector2(this.bounds.x / 2, this.bounds.y / 2),
            gravity = new Vector2(0, 0);
        gravity.x = this.attraction * (centerOfGravity.x - this.position.x);
        gravity.y = this.attraction * (centerOfGravity.y - this.position.y);
        return gravity;
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
        this.updateReplies();
        return this;
    };
    Post.prototype.updateReplies = function () {
        if (this.isSelected()) {
            if (this.replyList === null) {
                this.replyList = [];
                winchatty(
                    ["ChattyService.getThreadTree", this.data.id],
                    getReplies,
                    function (error) {
                        window.alert("Failed to access winchatty database: " + error);
                    }
                );
            } else if (this.replyList.length !== 0) {
                var replyList = this.replyList;
                replyList.forEach(function (replyA) {
                    var netVelocity = new Vector2(0, 0);
                    replyList.forEach(function (replyB) {
                        if (replyA === replyB) {
                            return;
                        }
                        var repulsion = repulseFrom.call(replyA, replyB),
                            attraction = new Vector2(0, 0);
                        if ($.inArray(replyB, replyA.children) > -1 || $.inArray(replyA, replyB.children) > -1) {
                            attraction = attractTo.call(replyA, replyB);
                        }
                        netVelocity.x += repulsion.x + attraction.x;
                        netVelocity.y += repulsion.y + attraction.y;
                    });
                    if (replyA === this.replyTree) { // if root post
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
        }
    };

    // Because I'm bad at Javascript scoping, I couldn't figure out how to put this in an anonymous function
    // inside the winchatty call in Post.prototype.updateReplies, and I couldn't figure out how to have it
    // be a function within Post.prototype and still be called with arguments.
    // So it's a standalone function.
    function getReplies(tree) {
        // http://programmers.stackexchange.com/questions/214227/
        var stack = [],
            replies = tree.replies,
            root = tree.replies[0];
        root.children = [];
        root.position = new Vector2(0, 0);
        root.velocity = new Vector2(0, 0);
        root.attraction = 0.01;
        root.repulsion = 600;
        root.damping = 0.3;
        stack.push(root);
        for (var i = 1; i < replies.length; i++) { // start at i=1 deliberately to skip root, handled above
            var reply = replies[i],
                delta = reply.depth - stack.length;
            reply.children = [];
            reply.div = jQuery('<div/>')
                .addClass('reply')
                .appendTo('#chatty');
            reply.position = new Vector2(Math.random() * Post.prototype.bounds.x, Math.random() * Post.prototype.bounds.y);
            reply.velocity = new Vector2(0, 0);
            reply.attraction = 0.01;
            reply.repulsion = 600;
            reply.damping = 0.3;
            if (delta > 0) {
                assert(delta === 1);
                stack.push(stack.front().children.front());
            }
            while (delta < 0) {
                stack.pop();
                delta++;
            }
            stack.front().children.push(reply);
        }
        Post.prototype.selectedPost.replyList = replies;
        Post.prototype.selectedPost.replyTree = root;
    };

    $('#title').text("Loading...");
    winchatty(
        ["ChattyService.getStories"],
        function (data) {
            var title = data[0].title,
                story_id = data[0].story_id;
            winchatty(
                ["ChattyService.getStory", story_id, 1],
                function (story) {
                    var posts = [];
                    story.threads.forEach(function(thread) {
                        posts.push(new Post(thread));
                    });
                    $('#title').text(title + ": " + story.story_name);
                    window.setInterval(function () { forceCalculationLoop(posts); }, framerate);
                },
                function (error) {
                    window.alert("Failed to access winchatty database: " + error);
                }
            );
        },
        function (error) {
            window.alert("Failed to access winchatty database: " + error);
        }
    );

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