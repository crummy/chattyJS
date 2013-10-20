$(function () {
    'use strict';

    var framerate = 1000 / 30;

    // Simple little Vector2 class for physics calculations
    var Vector2 = function _Vector2(x, y) {
        this.x = x;
        this.y = y;
    };

    Vector2.BaseVector =  {
        get: function () {
            return new this(0, 0);
        }
    };

    // Additional functionality to Array, used if you want to treat it like a stack.
    // Returns the last .push()'d entry... well technically just the last entry which hopefully is the last pushed.
    Array.prototype.front = function () {
        return this[this.length - 1];
    };
    // Simple assert function to double check my work when parsing replies.
    // Thanks http://stackoverflow.com/questions/15313418/javascript-assert
    var assert = function _assert(condition, message) {
        if (!condition) {
            throw message || "Assertion failed";
        }
    };







    var Post = function _Post() {
        var postRef = this;

        postRef.replyList = null;
        postRef.replyTree = null;
        postRef.velocity = Vector2.BaseVector;
        postRef.position = new Vector2(Math.random() * this.bounds.x, Math.random() * this.bounds.y);
        postRef.isHovered = false;
        postRef.div = jQuery('<div/>')
            .addClass('post')
            .appendTo('#chatty')
            .click(function (e) {
                Post.prototype.selectedPost = (postRef.isSelected() ? null : postRef); // a toggle
                e.preventDefault();
            });
    };
    Post.prototype.bounds = new Vector2(800, 600);
    Post.prototype.baseSize = 8;
    Post.prototype.hoveredSizeMultiplier = 2;
    Post.prototype.selectedSizeMultiplier = 3;
    Post.prototype.baseMass = 1;
    Post.prototype.attraction = 0.01;
    Post.prototype.repulsion = 600;
    Post.prototype.damping = 0.7;
    Post.prototype.selectedPost = null;
    Post.prototype.size = function _size() {
        var multiplier = (this.isSelected() ? this.selectedSizeMultiplier : (this.isHovered ? this.hoveredSizeMultiplier : 1));
        return this.baseSize * multiplier + Math.sqrt(this.reply_count);
    };
    Post.prototype.mass = function _mass() {
        return this.baseMass + 0.1 * Math.sqrt(this.reply_count);
    };
    Post.prototype.isSelected = function _isSelected() {
        return this === this.selectedPost;
    };
    Post.prototype.backgroundColour = function _backgroundColour() {
        var bgcolour = "black";
        if (this.category === "ontopic") {
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
    Post.prototype.getOpacity = function _getOpacity() {
        var isSelected = this.isSelected(),
            noneAreSelected = this.selectedPost === null;
        return ((noneAreSelected || isSelected) ? 1.0 : 0.5);
    };
    Post.prototype.update = function _update(velocity) {
        if ($(this.div).is(':not(:hover)')) { // as long as we aren't mouseovered,
            // move to new position, apply some damping to encourage stabilization,
            this.position.x += velocity.x * this.damping;
            this.position.y += velocity.y * this.damping;

            // and finally ensure we don't go out of bounds.
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x = 0;
            }
            if (this.position.x > this.bounds.x) {
                this.position.x = this.bounds.x;
                this.velocity.x = 0;
            }
            if (this.position.y < 0) {
                this.position.y = 0;
                this.velocity.y = 0;
            }
            if (this.position.y > this.bounds.y) {
                this.position.y = this.bounds.y;
                this.velocity.y = 0;
            }
        }

        // redraw
        $(this.div).css({
            'top':              this.position.y,
            'left':             this.position.x,
            'background-color': this.backgroundColour(),
            'width':            this.size(),
            'height':           this.size()
        }).fadeTo(0, this.getOpacity());

        if (this.isSelected()) {
            this.updateReplies();
        }
        return this;
    };
    Post.prototype.updateReplies = function _updateReplies() {
        var thisRef = this;
        thisRef.replyList = [];

        var updateCb = function _updateCb() {
            var replyList = thisRef.replyList;
            if (replyList.length !== 0) {
                replyList.forEach(function (replyA) {
                    var netVelocity = Vector2.BaseVector;
                    replyList.forEach(function (replyB) {
                        if (replyA !== replyB) {
                            var repulsion = $vectorUtils.repulseFrom(replyA, replyB),
                                attraction = Vector2.BaseVector;
                            if ($.inArray(replyB, replyA.children) > -1 || $.inArray(replyA, replyB.children) > -1) {
                                attraction = $vectorUtils.attractTo(replyA, replyB);
                            }
                            netVelocity.x += repulsion.x + attraction.x;
                            netVelocity.y += repulsion.y + attraction.y;
                        }
                    });
                    if (replyA === thisRef.replyTree) { // if root post
                        replyA.position = thisRef.position;
                    }
                    else {
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

        winChattyThread.load(updateCb);
    };

    var Reply = function _Reply() {
        this.children = [];
        this.position = new Vector2(Math.random() * Post.prototype.bounds.x, Math.random() * Post.prototype.bounds.y);
        this.velocity = Vector2.BaseVector;
        this.div = jQuery('<div/>')
            .addClass('reply')
            .appendTo('#chatty');
    };
    Reply.prototype.attraction = 0.01;
    Reply.prototype.repulsion = 600;
    Reply.prototype.damping = 0.3;
    // REVIEW: why a function?
    Reply.prototype.mass = function () {
        return 1;
    };

    // these generic-ish functions should be able to operate on both replies and posts
    var $vectorUtils = $({
        attractTo: function (from, to) {
            var attraction = Vector2.BaseVector;
            attraction.x += from.mass() * from.attraction * (to.position.x - from.position.x);
            attraction.y += from.mass() * from.attraction * (to.position.y - from.position.y);
            return attraction;
        },
        repulseFrom: function (from, to) {
            var repulsion = Vector2.BaseVector,
                rsq = Math.pow(this.position.x - to.position.x, 2) + Math.pow(from.position.y - to.position.y, 2);
            if (rsq === 0) {
                rsq = 0.00001;
            } // careful - don't divide by zero!
            repulsion.x = (from.repulsion * (from.position.x - to.position.x) / rsq);
            repulsion.y = (from.repulsion * (from.position.y - to.position.y) / rsq);
            return repulsion;
        },
        applyGravity: function (element) {
            var centerOfGravity = new Vector2(element.bounds.x / 2, element.bounds.y / 2),
                gravity = Vector2.BaseVector;
            gravity.x = element.attraction * (centerOfGravity.x - element.position.x);
            gravity.y = element.attraction * (centerOfGravity.y - element.position.y);
            return gravity;
        },
        // Applies a force-based calculation to every post.
        // mostly thanks to http://blog.ivank.net/force-based-graph-drawing-in-as3.html
        postCalculationLoop: function _postCalculationLoop(posts) {
            posts.forEach(function (postA) {
                var netVelocity = Vector2.BaseVector;
                posts.forEach(function (postB) {
                    if (postA === postB) {
                        return; // no need to compare a node to itself
                    }
                    var repulsion = Vector2.BaseVector,
                        attraction = Vector2.BaseVector,
                        gravity = $(this).applyGravity(postA, postB);
                    if (postA.category === postB.category) {
                        attraction = $(this).attractTo(postA, postB);
                    }
                    if (!postA.isSelected()) {
                        repulsion = $(this).repulseFrom(postA, postB);
                    }
                    netVelocity.x += repulsion.x + attraction.x + gravity.x;
                    netVelocity.y += repulsion.y + attraction.y + gravity.y;
                });
                postA.update(netVelocity);
            });
        }
    });

    function getThreads(story) {
        var posts = [];
        story.threads.forEach(function (thread) {
            var newPost = new Post();
            $.extend(newPost, thread);
            posts.push(newPost);
        });
        return posts;
    }

    $('#title').text("Loading...");


    $('#chatty').css({
        "height": Post.prototype.bounds.y,
        "width":  Post.prototype.bounds.x
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