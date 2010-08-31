// VimNav.user.js
// Version 1.1
//
// ==UserScript==
// @name        VimNav
// @author      Bernd Pol <bernd.pol@online.de>
// @licence     GPL
// @description Vim-like navigation in a webkit based browser.
// ==/UserScript==

/*
 * VERSIONS
 *
 * 1.1  Bugfix
 *      - proper handling of password fields 
 *        (no more VarNav functions called from inside)
 *      - input fields now properly selected
 *      - labels display unaltered 
 *        (could have been changed to uppercase if node parent did so)
 *      New Features
 *      - scroll height adjustable by factors 1, 2, 3, and 4
 *        (by default bound to "^1", "^2", "^3", and "^4")
 *
 * 1.0  Initial Release
 */
/* 
 * TODO
 * - second level commands (like "gu", etc.)
 * - repeat counts
 */
/*
 * KNOWN ISSUES
 *
 * On more complicated structured pages the browser (Midori only?) will call up
 * this script several times in a row. This will cause commands to be repeatedly
 * called up, once per running instance.
 * There is no way to detect such a multiple instatiating on the Javascript
 * level however which means:
 * - vertical movements will occur over multiples of the programmed distance
 *   (to cope for this situation a window height adjust factor has been
 *   introduced which will effectively reduce the height by which each movement
 *   call in a row will scroll the window, by default bound to ^1, ^2, ^3, ^4)
 * - hint labels will take significant more time to show up
 *   (hint-based navigation will be unaffected in most cases, however, as only
 *   one instance will effectively control the behaviour)
 */
/*
 * CREDITS
 *
 * This is inspired by (and was partially copied from): 
 * - the "vimkeybindings" greasemonkey script by "arno <arenevier@fdn.fr>"
 *   <http://userscripts.org/scripts/review/32369>
 * - the "KeyNav" greasemonkey script, version 0.1.1 beta by Itamar Benzaken
 *   <http://userscripts.org/scripts/review/33808>
 * - the "follow.js" uzbl link following script
 *   <http://www.uzbl.org/wiki/follow.sh>
 * - and the "goup", javascript version, uzbl page/domain switching script
 *   <http://www.uzbl.org/wiki/go-up>
 */

/* 
 * Note: This is a Midori browser specific script. 
 *       Using other browsers may require some rewrite.
 */

/****************
 *** Contents ***
 ****************/
/*
 * Configuration
 *      Key Bindings Configuration
 *          var keyBindings
 *          var navKeyBindings
 *      Basic Label Setup
 *          var autoselectLink
 *          var collSequence
 *          var overlayId
 *          var shortenLabels
 *          var nodeLabelSize
 *          var nodeLabelColor
 *          var nodeLabelBckground
 *          var partialLabelColor
 *          var partialLabelBackground
 *          var foundLabelColor
 *          var foundLabelBackground
 *          var nodeOpacity
 * Simple Navigation
 *      Small vertical movements
 *          function goUp()
 *          function goDown()
 *      Halfpage vertical movements
 *          function goHalfUp()
 *          function goHalfDown()
 *      Fullpage vertical movements
 *          function goPageUp()
 *          function goPageDown()
 *      Horizontal movements
 *          function goRight()
 *          function goLeft()
 *      Document wide vertical movements
 *          function goTop()
 *          function goBottom()
 *      URL dependent stuff
 *          function goUrlPageUp()
 *          function goUrlDomainUp()
 *      Adjust Movements
 *          function adjustHeight1()
 *          function adjustHeight2()
 *          function adjustHeight3()
 *          function adjustHeight4()
 *  Link Following
 *      Common variables
 *      Clear all link information
 *          function clearLinkInfo()
 *      Label handling
 *          function labelText( posNumber )
 *          function labelNumber( labelString )
 *          function positionOf( thisElement )
 *      Maintaining navigation information
 *          function isVisible( thisElement )
 *          function isDisplayable( thisElement )
 *          function findClickableNodes()
 *          function createOverlays()
 *          function showOverlays( labelHead )
 *          function hideOverlays()
 *          function redisplayOverlays()
 *          function removeOverlays()
 *      Navigating
 *          function isValidLabel( thisHead )
 *          function navigateByLabel()
 *          function clickLabel( labelPos )
 *          function startNavigating()
 *          function startNavNewTab()
 *          function stopNavigating()
 * Keyboard Interface
 *      function isEditable( element )
 *      function evalKey( keyEvent )
 *      function hasValidNavKey()
 *      function keyHandler( keyEvent )
 *      function keyRepeatHandler( keyEvent )
 * Script Body
 *      Initialization
 *      Register keyboard event handlers
 */

// -----------------------------------------------------------------------------
//                       start of configuration section
// -----------------------------------------------------------------------------

/*********************
 *** Configuration ***
 *********************/
/*
 * Key Bindings Configuration
 * ==========================
 * 
 * To use a Ctrl-key combination prepend "^" before the character
 * (e.g. "^b" denotes the Ctrl-b control).
 * Character case is implicit, e.g. "B" denotes Shift-b.
 *
 * The Esc key has been set up as universal stop action key which is treated
 * separately in the keydown event handler.
 *
 * NOTE:
 * Javascript apparently has problems to properly process language specific
 * keyboards (like umlauts on a german layout), thus best use the ASCII
 * character set only.
 *
 * NOTE:
 * Midori processes its own shortcuts before they reach this script. So make
 * sure there are no conflicts.
 * --> If necessary redefine conflicting Midori specific shortcuts there in
 *                       Tools->Customize Shortcuts...
 */
/*
 * Standard key bindings
 * ---------------------
 */
var keyBindings = {
    "h" : goLeft, 
    "l" : goRight,
    "k" : goUp,
    "j" : goDown,
    "K" : goHalfUp,
    "J" : goHalfDown,
    "u" : goPageUp,
    "d" : goPageDown,
    "t" : goTop,
    "b" : goBottom,
    "U" : goUrlPageUp,
    "D" : goUrlDomainUp,
   "^1" : adjustHeight1,    // factors to decrease the effective window
   "^2" : adjustHeight2,    // height in scrolling (sometimes useful
   "^3" : adjustHeight3,    // when this script was called up multiple
   "^4" : adjustHeight4,    // times in a row)
    "f" : startNavigating,  // if autoselecting, open match in current tab
    "F" : startNavNewTab,   // if autoselecting, open match in a new tab
}
/*
 * Navigation key bindings
 * -----------------------
 * These provide some page movement actions when navigating by labels where the
 * usual navigation keys are not available.
 *
 * NOTE: These bindings are only valid when navigating. Otherwise the standard
 *       bindings defined above apply.
 */
var navKeyBindings = {
    "^h" : goLeft, 
    "^l" : goRight,
    "^k" : goUp,
    "^j" : goDown,
    "^t" : goTop,
    "^b" : goBottom,
    "^s" : redisplayOverlays,
    "^d" : hideOverlays,
    "^r" : repositionLabels,    // sometimes useful if labels overlap
    "^f" : stopNavigating,  
}
/*
 * Basic Label Setup
 * =================
 */
/*
 * Link selection behaviour
 * ------------------------
 */
/*
 * How to select a link
 * --------------------
 * If true this will select link as soon as there is a match.
 * Otherwise the user must confirm the selection:
 * Return:  open link in this tab
 * Space:   open link in new tab
 * Although this requires an additional keypress it allows for selecting another
 * link (via backspace correction).
 */
var autoselectLink = true;
/*
 * If not autoselecting we need some special keys to trigger the selection.
 */
var openInThisTab = "g";
var openInNewTab = "t";
/*
 * Collateral Sequences
 * -----------------------
 * 
 * There are several label number representations possible. Just uncomment the
 * one you want.
 *
 * Note that the first symbol in sequence will be treated as zero equivalent
 * and the labels will be get those zero equivalents prepended if necessary,
 * e.g. the number 1 in a three-digit "alpha" sequence will show as "aab".
 */
var collSequence = "optimal";   // automatic: find shortest to type sequence
// var collSequence = "numeric";   // decimal numbers
// var collSequence = "alpha";     // lower case letter sequences
// var collSequence = "longalpha"; // lower followed by upper case letters
// This can be any unique sequence of symbols, e.g.:
// var collSequence = "asdfghjkl"; // home row keys (for touch typers)
// var collSequence = "uiophjklnm"; // right hand only
/*
 * The overlay identification
 * --------------------------
 * This will be prepended to every label overlay element. Redefine if there are
 * name conflicts.
 */
var overlayId = "VimNavLabel";
/*
 * Node label display
 * ------------------
 */
var shortenLabels = true;   // show matching labels and selectable digits only
/*
 * This defines the font size shown in the labels. It may be an absolute number
 * with a trailing "px" giving the font height in pixels, a number with trailing
 * "%" giving the height relative to the parents font size, or one of the
 * predefined font size property values (ranging from smallest to largest):
 * "xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large"
 * or defining a relative value to the parent font size:
 * "smaller", "larger"
 * ( see also: http://www.w3schools.com/jsref/prop_style_fontsize.asp )
 */
var nodeLabelSize = "12px";
//var nodeLabelSize = "85%";
//var nodeLabelSize = "small";

var nodeLabelColor = "red";
var nodeLabelBackground = "lightyellow";

var partialLabelColor = "blue";
var partialLabelBackground = "lightgreen";

var foundLabelColor = "yellow";
var foundLabelBackground = "red";

var nodeOpacity = 0.6;

// -----------------------------------------------------------------------------
//                        end of configuration section
// -----------------------------------------------------------------------------

/*************************
 *** Simple Navigation ***
 ************************/

var wndHeight;              // height of the currently focused window
var wndHeightAdjust = 1;    // factor to decrease the height movement
var keyLabel;               // label value of current key
var keyCode;                // code value of current key
var keyAction = 0;          // the action to perform on the current key
/*
 * Small vertical movements
 */
function goUp() {
    window.scrollBy( 0, -5 );
}

function goDown() {
    window.scrollBy( 0, 5 );
}
/*
 * Halfpage vertical movements
 */
function goHalfUp() {
    window.scrollBy( 0, -1 * ((wndHeight / wndHeightAdjust) / 2) );
}

var sc = 0;
function goHalfDown() {
    window.scrollBy( 0, (wndHeight / wndHeightAdjust) / 2 );
}
/*
 * Fullpage vertical movements
 */
function goPageUp() {
    window.scrollBy( 0, -1 * (wndHeight / wndHeightAdjust) );
}

function goPageDown() {
    window.scrollBy( 0, wndHeight / wndHeightAdjust );
}
/*
 * Horizontal movements
 */
function goRight() {
    window.scrollBy( 15, 0 );
}

function goLeft() {
    window.scrollBy( -15, 0 );
}
/*
 * Document wide vertical movements
 */
function goTop() {
    window.scroll( 0, 0 );
}

function goBottom() {
    window.scroll( document.width, document.height );
}
/*
 * URL dependent stuff
 * ===================
 */
/*
 * Go up one page in the URL
 * -------------------------
 */
function goUrlPageUp() {
    /*
     * Most of this could be inline below. We compute these here to keep the
     * switching stuff better readable.
     * TODO
     * There is a recursion problem if the shortened URL was implicitely
     * expanded to point to the current page again. This could be caught if
     * there was a possibilitiy to keep the current URL somehow globally when
     * the document reloads.
     */
    var oldLocation = window.location;
    var newLocation = null;
    var newLocArray = 
        window.location.href.match(/(\w+:\/\/.+?\/)([\w\?\=\+\%\&\-\.]+\/?)$/);
    if (newLocArray) {
        newLocation = newLocArray[1];
    }
    /*
     *  Now go up one level if possible.
     */
    if (newLocation && newLocation != oldLocation) {
        window.location = newLocation;
    }
    /*
     * We are at the top page already. Let the user know this.
     */
    else    
        alert( "Already at top page. Cannot go further up." );
}
/*
 * Go up one domain in the URL
 * ---------------------------
 */
function goUrlDomainUp() {
    var oldDomain = document.domain;
    var newDomain = null;
    /*
     * Even if we do not often need subdomain switching let's keep this stuff
     * more readable, too.
     */
    var subDomArray = 
        oldDomain.match(/^(?!www\.)\w+\.(.+?)\.([a-z]{2,4})(?:\.([a-z]{2}))?$/);
    if (subDomArray) {
        /*
         * The URL is now broken up into array elements.
         * We take the subdomain out and join everything together to th new URL.
         */
        var subDomL = subDomArray.length;
        newDomain = 
            window.location.protocol + "//" + 
            subDomArray.slice(1, subDomArray[subDomL] ? subDomL
                                                      : subDomL-1).join(".");
    }
    /*
     * Go up one sub domain level if possible.
     */
    if (newDomain) {
        window.location = newDomain;
    }
    /*
     * We are at the top domain already. Let the user know this.
     */
    else    
        alert( "Already at top domain. Cannot go further up." );
}
/*
 * Adjust Movements
 * ================
 *
 * These functions only set the wndHeightAdjust factor in order to cope whith
 * situations where the browser (Midori only?) initializes the script multiple
 * times (which currently can happen on complicated structured pages).
 * Their only purpose is to bind these adjustments to some keys.
 */
function adjustHeight1() {
    wndHeightAdjust = 1;
}

function adjustHeight2() {
    wndHeightAdjust = 2;
}

function adjustHeight3() {
    wndHeightAdjust = 3;
}

function adjustHeight4() {
    wndHeightAdjust = 4;
}

/**********************
 *** Link Following ***
 **********************/
/*
 * Common variables
 */
var navigating = false;
var openNewTab = false;
var waitForConfirmation = false;

var clickableNodes;
var labelsOverlays;
var nodeLabels;

var hasLinkNodes;
var curLabelHead;
var curLabelNum;
var matchingLabelNum;
var labelDigits;

var useSequence;
var useBase;

var relPosLabels = false;
/*
 * Clear All Link Information
 * --------------------------
 */
function clearLinkInfo() {
    removeOverlays();
    labelsOverlays = null;
    nodeLabels = null;
    clickableNodes = null;
    hasLinkNodes = false;
    curLabelHead = "";
    curLabelNum = -1;   // marks number as invalid
    matchingLabelNum = -1;
    labelDigits = 0;
    waitForConfirmation = false;
    relPosLabels = false;
}
/*
 * Label Handling
 * ==============
 */
/*
 * Construct the Label Text For a Given Position Number
 * ----------------------------------------------------
 * @param posNumber decimal position number
 *                  (must be >= 0)
 * @return          string representation of this number according to the
 *                  predefined collateral sequence.
 *                  Leading filled with the zero equivalence of the predefined
 *                  collateral sequence up to labelDigits length.
 */
function labelText( posNumber ) {
    var head = posNumber;
    var remainder = 0;
    var labelString = "";
    /*
     * Numeric sequences should count from 1 instead from 0.
     */
    if (collSequence == "numeric" ||
        (collSequence == "optimal" && useSequence.charAt(0) == "0"))
        head++;
    /*
     * Compute the symbolic digits.
     */
    if (head == 0) {
        labelString = useSequence.charAt(0);
    }
    while (head > 0) {
        remainder = head % useBase;
        labelString = useSequence.charAt(remainder) + labelString;
        head = (head - remainder) / useBase;
    }
    // Fill with the zero equivalent of this collateral sequence.
    while (labelString.length < labelDigits) {
        labelString = useSequence.charAt(0) + labelString;
    }
    return labelString;
}
/*
 * Construct the Label Lumber For a Given Label String
 * ---------------------------------------------------
 * @param labelString   string representation of the label
 * @return              decimal equivalent according to the prdefined
 *                      collataration sequence.
 */
function labelNumber( labelString ) {
    var posNumber = 0;
    var curBase = useBase;
    var curDigit;

    for (var i=labelString.length-1; i >= 0; i--) {
        curDigit = labelString.charAt(i);
        posNumber += useBase * useSequence.indexOf(curDigit);
        curBase *= useBase;
    }
    /*
     * Adjust for numeric counting from 1 instead of 0.
     */
    if (collSequence == "numeric" ||
        (collSequence == "optimal" && useSequence.charAt(0) == "0"))
        posNumber--;

    return posNumber;
}
/*
 * Evaluate the position of an element
 * -----------------------------------
 *
 *  @param  thisElement element to inspect
 *  @return array [upper, left, width, height] of position and size
 */
function positionOf( thisElement ) {
    var upper;
    var left;
    var width;
    var height;

    var curName;
    var curElement;
    
    upper = thisElement.offsetTop;
    left = thisElement.offsetLeft;
    width = thisElement.offsetWidth;
    height = thisElement.offsetHeight;
    
    curElement = thisElement;
    while (curElement.offsetParent) {
        curElement = curElement.offsetParent;
        curName = curElement.nodeName.toLowerCase();
        if (curName != "div" && curName != "fieldset" && curName != "li") {
            upper += curElement.offsetTop;
            left += curElement.offsetLeft;
        }
    }
    return [upper, left, width, height];
}
/*
 * Switch the relative positions mode of the labels display.
 * ---------------------------------------------------------
 * In some elements (i.e. some tables containing links) some labels might be put
 * one over the other which makes the overwritten ones unaccessible. In these
 * cases the labels often can be separated if the relative positions of the
 * nodes they belong to will be used. This switch accomplishes that task.
 *
 * We should not make this a standard behaviour, however, because it often will
 * result in the browser trying to display the labels outside the current
 * viewport.
 *
 * NOTE: This feature is meant to be used during labels navigation only. Thus
 * bind it to navKeyBindings instead of plain keyBindings.
 */
function repositionLabels() {
    var newPosMode = ! relPosLabels;

    hideOverlays();
    removeOverlays();
    relPosLabels = newPosMode;
    createOverlays()
    showOverlays( curLabelHead );
}
/*
 * Maintaining Navigation Information
 * ==================================
 */
/*
 * Check visibility of an element.
 * -------------------------------
 * Recursively checks the given Element wether it is not hidden.
 *
 * @param   thisElement  node to be checked.
 * @return  true if this Element is not hidden and not behind a hidden parent in
 *          the DOM tree.
 */
function isVisible( thisElement ) {
    if ( thisElement == document ) {
        return true;
    }
    if ( ! thisElement ) {
        return false;
    }
    if ( ! thisElement.parentNode ) {
        return false;
    }
    if ( thisElement.style ) {
        if ( thisElement.style.display == 'none' ) {
            return false;
        }
        if ( thisElement.style.visibility == 'hidden' ) {
            return false;
        }
    }
    return isVisible( thisElement.parentNode );
}
/*
 * Check if the element is displayable at all.
 * -------------------------------------------
 *
 * @param   thisElement element to check
 * @return  false if the element width or height are equal or below zero
 */
function isDisplayable( thisElement ) {
    var width = thisElement.offsetWidth;
    var height = thisElement.offsetHeight;

    if (width <= 0 || height <= 0)
        return false;
    else
        return true;
}
/*
 * Find Clickable Elements in the Document
 * ---------------------------------------
 * Scans the child nodes of the current ducument for those being clickable.
 *
 * @return  clickableNodes: array of clickable child nodes collected
 *          labelDigits:    number of label digits required by this
 *                          collateral sequence
 */
function findClickableNodes() {
    /*
     * Make sure to always start in a clear state.
     */
    clearLinkInfo();
    clickableNodes = new Array();
    /*
     * Recursively scan the DOM-provided document links array.
     */
    function addClickableNodesIn( thisParent ) {
        for (var i = 0; i < thisParent.childNodes.length; i++) {
            var curNode = thisParent.childNodes[i];
            /*
             * Look at available and visible type 1 nodes only.
             */
            if (curNode.nodeType == 1 &&
                isDisplayable( curNode ) && 
                isVisible( curNode )) {
                /*
                 * Check if this is a clickable element and
                 * add it to the clickableNodes array if so.
                 */
                var isClickable = 
                    curNode.nodeName.toLowerCase()=="input" |
                    curNode.nodeName.toLowerCase()=="select" |
                    curNode.nodeName.toLowerCase()=="textarea" |
                    curNode.hasAttribute( "tabindex" ) |
                    curNode.hasAttribute( "href" ) |
                    curNode.hasAttribute( "onclick" );
                if (isClickable) {
                    clickableNodes.push( curNode );
                }
            }
            /*
             * Recursively check for clickable nodes in the childs of this one.
             */
            addClickableNodesIn( curNode );
        }
    }
    /*
     * Now start this scan at the document root.
     */
    addClickableNodesIn( document );
    /*
     * If wanted now find an optimal collateral sequence for labels display.
     */
    var curLength = clickableNodes.length;
    /*
     * Do so only if there are any clickable nodes at all.
     */
    if (curLength > 0) {
        hasLinkNodes = true;
    } else {
        hasLinkNodes = false;
        return;
    }

    if (collSequence == "optimal") {
        if (curLength < 10) {
            // Labels need one number digit only.
            useSequence = "0123456789";
            useBase = 10;
        } 
        else if (curLength < 50) {
            // Labels displayable with one longalpha digit.
            useSequence = "abcdefghijklmnopqrstuvxyzABCDEFGHIJKLMNOPQRSTUVXYZ";
            useBase = 50;
        } 
        else if (curLength > 99) {
            // Labels would need more than three number digits.
            // Note: This could as well be a lower + upper case sequence but
            //       using lower case only appears to be more practical.
            useSequence = "abcdefghijklmnopqrstuvxyz";
            useBase = 25;
        } 
        else {
            // Labels displayable with two number digits.
            useSequence = "0123456789";
            useBase = 10;
        }
    }
    /*
     * Finally compute the number of digits the labels need to show.
     */
    while (curLength > 1) {
        labelDigits++;
        curLength /= useBase;
    }
}
/*
 * Create Labels Overlays
 * ----------------------
 * Requires the clickableNodes being evaluated already and no overlays being
 * created yet.
 *
 * @return  labelsOverlays: array of label elements
 *          nodeLabels:     array of label texts
 */
function createOverlays() {
    var curElement;
    var curLabel;
    var curOverlay;
    var curPosition;
    /*
     * Do nothing if there are no clickable nodes at all.
     */
    if (! hasLinkNodes)
        return;
    /*
     * Scan the clickableNodes and construct a labels overlay for each.
     */
    labelsOverlays = new Array();
    nodeLabels = new Array();

    for (var i = 0; i < clickableNodes.length; i++) {
        curLabel = labelText( i );
        curElement = clickableNodes[i];
        curPosition = positionOf( curElement );
        /*
         * Create a hidden overlay for this element.
         */
        curOverlay    = document.createElement( "span" );
        curOverlay.id = overlayId;
        //
        curOverlay.style.position   = "absolute";
        if (relPosLabels) {
            curOverlay.style.left   = curPosition[1] + "px";
            curOverlay.style.top    = curPosition[0] + "px";
        }
        curOverlay.style.width      = "auto";
        curOverlay.style.padding    = "1px";
        curOverlay.style.background = nodeLabelBackground;
        curOverlay.style.fontSize   = nodeLabelSize;
        curOverlay.style.fontWeight = 'bold';
        curOverlay.style.fontColor  = "black";
        curOverlay.style.textTransform = "none";
        //
        curOverlay.style.zorder = 1000;    // always on top
        curOverlay.style.opacity = nodeOpacity;
        //
        curOverlay.style.border     = "1px dashed darkgray";
        curOverlay.style.fontColor  = "black";
        //
        curOverlay.style.visibility = "hidden";
        // This will be displayed:
        curOverlay.innerHTML = 
            "<font color=\"" + 
            nodeLabelColor + "\">" + 
            curLabel + 
            "</font>";
        //
        labelsOverlays.push( curOverlay );
        nodeLabels.push( curLabel );
        /*
         * Insert this into the document as sibling of the current element.
         */
        curElement.parentNode.insertBefore( curOverlay, curElement );
    }
}
/*
 * Show Labels Overlays
 * --------------------
 * Shows overlays starting with labelHead, hides all others.
 * If no direct match yet show the label tails only. Else show the complete
 * label.
 *
 * @param   labelHead   initial character sequence of the labels to be shown
 *                      where only the remaining tail will be displayed
 *                      if "*":   show all labels without change
 *                      if "":    reset and show all labels
 * 
 */
function showOverlays( labelHead ) {
    var curLabel;
    var curOverlay;
    var headLength = labelHead.length;
    /*
     * Do nothing if there are no clickable nodes at all.
     */
    if (! hasLinkNodes)
        return;
    /*
     * Scan the labels overlays array.
     */
    for (var i = 0; i < labelsOverlays.length; i++) {
        labelsOverlays[i].style.visibility = "hidden";
        curLabel = nodeLabels[i];

        if (labelHead == "") {
            // Restore the label text to all digits and show the label.
            labelsOverlays[i].innerHTML = 
                "<font color=\"" + 
                nodeLabelColor + "\">" + 
                curLabel + 
                "</font>";
            labelsOverlays[i].style.visibility = "visible";
        } 
        else if (labelHead == "*") {
            if (matchingLabelNum >= 0)
                labelsOverlays[matchingLabelNum].style.visibility = "visible";
            else
                labelsOverlays[i].style.visibility = "visible";
        } 
        else {
            if (curLabel.substring( 0, headLength) == labelHead) {
                if (headLength != labelDigits) {
                    /*
                     * This is a partial label.
                     */
                    if (shortenLabels) {
                        // Show relevant digits only.
                        labelsOverlays[i].innerHTML = 
                            "<font color=\"" + 
                            nodeLabelColor + "\">" + 
                            curLabel.substring( headLength, labelDigits ) +
                            "</font>";
                    } else {
                        // Mark matching labels differently.
                        labelsOverlays[i].innerHTML = 
                            "<font style=\"background: " +
                            partialLabelBackground + "\" color=\"" + 
                            partialLabelColor + "\">" + 
                            curLabel +
                            "</font>";
                    }
                }
                else {
                    // This is a full match, remember and show it.
                    matchingLabelNum = i;
                    labelsOverlays[i].innerHTML = 
                        "<font color=\"" + 
                        foundLabelColor +
                        "\" style=\"background: " +
                        foundLabelBackground + "\">" + 
                        curLabel +
                        "</font>";
                }
                /*
                 * Show this label
                 */
                labelsOverlays[i].style.visibility = "visible";
            } 
            /*
             * Treat nonmatching labels here.
             */
            else {
                // Restore to full label representation.
                labelsOverlays[i].innerHTML =
                    "<font color=\"" + 
                    nodeLabelColor + "\">" + 
                    curLabel + 
                    "</font>";

                if (shortenLabels) 
                    labelsOverlays[i].style.visibility = "hidden";
                else 
                    labelsOverlays[i].style.visibility = "visible";
            }
        }
    }
}
/*
 * Hide overlays
 * -------------
 * Hides every label overlay.
 */
function hideOverlays() {
    /*
     * Do nothing if there are no clickable nodes at all.
     */
    if (! hasLinkNodes)
        return;
    /*
     * Scan the labels overlays array and hide the nodes displays.
     */
    for (var i = 0; i < labelsOverlays.length; i++) {
        labelsOverlays[i].style.visibility = "hidden";
    }
}
/*
 * Display overlays again
 * ----------------------
 */
function redisplayOverlays() {
    showOverlays( curLabelHead );
}
/*
 * Remove label overlays
 * ---------------------
 * Removes all labels overlays.
 *
 * NOTE: This invalidates the overlays and should not be called out of context.
 */
function removeOverlays() {
    /*
     * Do nothing if there are no overlays at all.
     */
    if (! hasLinkNodes) {
        return;
    }
    /*
     * Track the labels overlays array and remove the node elements kept from
     * their parents.
     */
    var curNode;
    for (var i = 0; i < labelsOverlays.length; i++) {
        curNode = labelsOverlays[i];
        curNode.parentNode.removeChild(curNode);
    }
}
/*
 * Navigating
 * ==========
 */
/*
 * Check if the label is valid.
 * ----------------------------
 * Checks if a label starting with the given digits sequence is known in the
 * nodeLabels array.
 *
 * @param   thisHead    head sequence of the label to check
 * @return  true        there are labels starting with this sequence
 *                      curLabelNum: number of first occurence found
 *          false       there are no such labels known
 *                      curLabelNum: -1
 */
function isValidLabel( thisHead ) {
    if (thisHead == "") {
        curLabelNum = -1;
        return false;
    }
    var headLength = thisHead.length;

    for( var i = 0; i < nodeLabels.length; i++ ) {
        if (thisHead == nodeLabels[i].substring( 0, headLength )) {
            curLabelNum = i;
            return true;
        }
    }
    curLabelNum = -1;
    return false;
}
/*
 * Navigate by label
 * -----------------
 * Process the current key to find an according link label and perform the
 * proper action there.
 */
function navigateByLabel() {
    if (waitForConfirmation) {
        /*
         * We found a match but the user must tell what to do with it.
         */
        if (keyLabel == openInThisTab) {
            openNewTab = false;
            waitForConfirmation = false;
            clickLabel( matchingLabelNum );
        }
        else if (keyLabel == openInNewTab) {
            openNewTab = true;
            waitForConfirmation = false;
            clickLabel( matchingLabelNum );
        }
        else if (keyCode == 0x08) { // backspace
            waitForConfirmation = false;
            matchingLabelNum = -1;  // removes the match in any case
            /*
             * Remove trailing character from the selection.
             */
            curLabelHead = 
                curLabelHead.substring( 0, 
                    curLabelHead.length - 1 );
            showOverlays( curLabelHead );
        }
    }
    /*
     * We assume only numbers or ASCII characters will be used in labels.
     */
    else if (hasValidNavKey()) {
        if (isValidLabel( curLabelHead + keyLabel )) {
            /*
             * The key belongs to a valid label. Show the resulting
             * selection.
             */
            curLabelHead = curLabelHead + keyLabel;
            showOverlays( curLabelHead );

            if (matchingLabelNum != -1) {
                /*
                 * We found a match.
                 */
                if (autoselectLink) {
                    waitForConfirmation = false;
                    clickLabel( matchingLabelNum );
                } else {
                    waitForConfirmation = true;
                    //clickLabel( matchingLabelNum );
                }
                keyAction = null;
                return;
            }
        } else {
            /*
             * Simply skip the invalid entry.
             */
            keyAction = null;
            return;
        }
    } 
    /*
     * If neither character or number, some other action, e.g. simple extra
     * navigation to properly show the labels in the viewport, may be
     * wanted.
     */
    else {
        if (keyCode == 0x08) { // backspace
            /*
             * Remove trailing character from the selection.
             */
            if (curLabelHead != "") {
                matchingLabelNum = -1;  // removes the match in any case
                curLabelHead = 
                    curLabelHead.substring( 0, 
                        curLabelHead.length - 1 );
                waitForConfirmation = false;
                showOverlays( curLabelHead );
            }
        }
        else {
            /*
             * Look up if there is some special action to perform.
             */
            keyAction = navKeyBindings[keyLabel];
        }
    }
}
/*
 * Simulate a Mouseclick
 * ---------------------
 *
 *  @param  labelPos    number of the label to be clicked on
 */
function clickLabel( labelPos ) {
    var curElement = clickableNodes[ labelPos ];
    var curLabel = nodeLabels[ labelPos ];
    var curName = curElement.nodeName.toLowerCase();

    stopNavigating();

    if (curName == "a") {
        /*
         * It is a link. Just go there.
         */
        if (openNewTab) {
            openNewTab = false;
            window.open( curElement.getAttribute( "href" ), "", "" ); 
        } else {
            window.location = curElement.getAttribute("href");
        }
    }
    else if (curElement.hasAttribute("onclick")) {
        /*
         * This requires some more effort in order to trigger the attached
         * actions.
         * At first we need a special event to track mouse clicks.
         */
        var thisEvent = document.createEvent("MouseEvents");
        /*
         * Then the mouse click action needs to be defined.
         */
        thisEvent.initMouseEvent(
            "click",        // the event type
            true, true,     // allow bubbles and default action cancels
            window,         // this view's base
            0,              // mouse click count
            0, 0, 0, 0,     // screen and client coordinates
            false, false,   // no control or alt key depressed simultaneously
            false, false,   // ditto, shift or meta key
            0,              // mouse button
            null);          // no other related target
        /*
         * Finally get this known to the system.
         */
        curElement.dispatchEvent(thisEvent);
    } 
    else if (curName == "input") {
        /*
         * There are several types of input elements which need be handled
         * differently.
         */
        var curType = curElement.getAttribute('type').toLowerCase();

        if (curType == 'text' || curType == 'file' || curType == 'password') {
            /*
             * These need be explicitely selected.
             */
            curElement.focus();
            curElement.select();
            curElement.click();
        } else {
            /*
             * It is a genuine input element. 
             * This allows us to use the click() method.
             */
            curElement.click();
        }
    }
    else if (curName == 'textarea' || curName == 'select') {
        /*
         * Handle these like the special input element types.
         */
        curElement.focus();
        curElement.select();
    } 
    else if (curElement.hasAttribute( "href" )) {
        /*
         * Handle a possible not detected link.
         */
        if (openNewTab) {
            openNewTab = false;
            window.open( curElement.getAttribute( "href" ), "", "" ); 
        } else {
            window.location = curElement.getAttribute("href");
        }
    }
    else {
        alert ("Could not click element " + curLabel +
               ": " + curName +
               "\nNo idea what to do with it." );
    }
}
/*
 * Start Navigating
 * ----------------
 */

// If autoselecting, open in new tab.
function startNavNewTab() {
    openNewTab = true;
    startNavigating();
}

// If autoselecting, open in current tab.
function startNavigating() {
    navigating = true;
    waitForConfirmation = false;

    if (hasLinkNodes) {
        clearLinkInfo();
    }
    findClickableNodes();
    if (hasLinkNodes) {
        createOverlays();
        showOverlays("");
    } else {
        navigating = false;
        alert( "No clickable node found on this page." );
    }
}
/*
 * Stop Navigating
 * ---------------
 */
function stopNavigating() {
    hideOverlays();
    navigating = false;
    clearLinkInfo();
}

/**************************
 *** Keyboard Interface ***
 **************************/

/*
 * Check for an editable element
 * -----------------------------
 * @param element   DOM element to be checked
 * @return          true if element is editable
 *                  (i.e. shall receive all keys)
 *                  false otherwise.
 */
function isEditable( element ) {
    if ( element.nodeName.toLowerCase() == "textarea" )
        return true;
    if ( element.nodeName.toLowerCase() == "input" && 
         ( element.type == "text" || element.type == "password" ) )
        return true;
    if ( document.designMode == "on" || element.contentEditable == "true" ) 
        return true;
    return false;
}
/*
 * The Keyboard Event Handlers
 * ===========================
 */
/*
 * Evaluate the key in the given keyEvent
 * --------------------------------------
 * @param   keyEvent    event to evalute
 * @return  function pointer in the keyAction variable.
 */
function evalKey( keyEvent ) {
    wndHeight = window.innerHeight - Math.max( window.innerHeight / 10, 2 );

    // Handle specific key codes.
    // NOTE: Might be device specific, not thoroughly tested.
    keyCode = keyEvent.keyCode;
    // Account for keypad (NumLock on).
    if ( keyCode >= 96 && keyCode <= 105 )
        // numbers
        keyCode -= 48;
    else if ( keyCode >= 106 && keyCode <= 110 )
        // operators and punctuation
        keyCode -= 64;

    // Convert to character representation.
    keyLabel = String.fromCharCode( keyCode );
    /* 
     * We must explicitely process the shift key because the the keyCode
     * conversion will always return upper case.
     */
    if ( ! keyEvent.shiftKey && keyCode >= 32 )
        keyLabel = String.fromCharCode( keyCode ).toLowerCase();
    if ( keyEvent.ctrlKey )
        keyLabel = "^" + keyLabel;
    /*
     * Evaluate the action to be performed.
     */
    if (! navigating) {
        keyAction = keyBindings[keyLabel];
    }
    else {
        keyAction = navKeyBindings[keyLabel];
        /*
         * Any invalid input stops navigating.
         */
//        if (! keyAction && ! hasValidNavKey() ) {
//            stopNavigating();
//        }
    }
}
/*
 * Check for a valid navigation key
 * --------------------------------
 * Checks the current keyLabel if it is a number or an ASCII character.
 *
 * @return  true if this is a valid navigation key.
 */
function hasValidNavKey() {
    if (keyLabel >= "0" && keyLabel <= "9" || 
        keyLabel >= "a" && keyLabel <= "z" ||
        keyLabel >= "A" && keyLabel <= "Z") {
        return true;
    } else {
        return false;
    }
}
/*
 * Handle most keypresses here
 * ---------------------------
 * @param   keyEvent    event to evalute
 */
function keyHandler( keyEvent ) {
    keyAction = null;

    if (navigating) {
        evalKey( keyEvent );
        navigateByLabel();
    }
    else {
        /*
         *  Skip targets which need keypresses by their own.
         */
        if (isEditable( keyEvent.target )) {
            return;
        }
        /*
         * The Esc key has been handled on key down already so skip it here.
         */
        if (keyEvent.keyCode == 0x1b) {
            return;
        }
        /*
         *  Evaluate the function the key is bound to and execute it.
         */
        evalKey( keyEvent );
    }
    /*
     * Now perform the pending command.
     */
    if (keyAction) {
        // Prevent double execution of repeatable commands.
        if ( keyAction != goLeft  && 
            keyAction != goRight &&
            keyAction != goUp    &&
            keyAction != goDown ) {
            keyAction();
        }
    }
}
/*
 * Handle repeatable keys
 * ----------------------
 * There are a few commands which may be repeatably executed.
 * They need be handled separately as auto-repeat works on downheld keys only.
 *
 * @param   keyEvent    event to evalute
 *
 * NOTE:
 * There is some (possible Midori related) bug where javascript appears to send
 * keys twice if NumLock is on. Hence we restrict this to small movements only.
 */
function keyRepeatHandler( keyEvent ) {
    keyAction = null;
    /*
     * There is only one keydown action to perform if we are navigating 
     * by labels.
     */
    if (navigating) {
        /*
         * The Esc key is a stop all feature.
         * Hence check for this one first.
         */
        if (keyEvent.keyCode == 0x1b) {
            stopNavigating();
            return;
        }
    }
    /*
     * Otherwise handle some special cases.
     */
    else {
        // Skip targets which need keypresses by their own.
        if (isEditable( keyEvent.target )) {
            return;
        }
    }
    /* 
     * Evaluate the function the key is bound to and execute it.
     */
    evalKey( keyEvent );
    if (keyAction) {
        // Execute repeatable commands only.
        if (keyAction == goLeft  || 
            keyAction == goRight ||
            keyAction == goUp    ||
            keyAction == goDown ) {
            keyAction();
        }
    }
}

/*******************
 *** Script Body ***
 *******************/
/*
 * Initialization
 * ==============
 */
/*
 * Make sure to start in a clean state.
 */
clearLinkInfo();
wndHeightAdjust = 1;
/*
 * Set up a static labels collation sequence according to the configuration.
 */
if (collSequence == "numeric") {
    useSequence = "0123456789";
    useBase = 10;
} 
else if (collSequence == "alpha") {
    useSequence = "abcdefghijklmnopqrstuvxyz";
    useBase = 25;
} 
else if (collSequence == "longalpha") {
    // We use lower key characters first, then upper key ones
    // to ease the typing.
    useSequence = "abcdefghijklmnopqrstuvxyzABCDEFGHIJKLMNOPQRSTUVXYZ";
    useBase = 50;
} 
else if (collSequence != "optimal") {
    useSequence = collSequence;
    useBase = collSequence.length;
} 
/*
 * Register keyboard event handlers.
 */
window.addEventListener( "keyup", keyHandler, false );
window.addEventListener( "keydown", keyRepeatHandler, false );

// ----------------------------------------------------------------------------
// vim:shiftwidth=4:softtabstop=4:expandtab:textwidth=80
