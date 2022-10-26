"use strict";
import {directions} from "./map.js";

/**
 * NOTES:   We are currently hardcoding Keyboard Bindings to keep things simple
 *      Similiarly, we are making everything an Object/mapping so all Keybindings
 *      can be accessed uniformly regardless of whether the key binding has
 *      alternative keys.
 *      We currently do not output a master list of keybindings because each
 *      "page" should be responsible for its own keybindings (there is no
 *      part of the program which needs to know all keybindings)
 */

// Keyboard Bindings for Map Movement
const KEYDIRECTIONS = Object.freeze({
    w: directions.NORTH,
    W: directions.NORTH,
    ArrowUp: directions.NORTH,
    d: directions.EAST,
    D: directions.EAST,
    ArrowRight: directions.EAST,
    s: directions.SOUTH,
    S: directions.SOUTH,
    ArrowDown: directions.SOUTH,
    a: directions.WEST,
    A: directions.WEST,
    ArrowLeft: directions.WEST
});

// Keyboard Binding for Map Inventory activation
const INVENTORY = {"i": true, "I": true};

const SELECT = {"Enter": true};

// Keyboard Binding for Cancel/Back
const CANCEL = {"Escape": true};

export {KEYDIRECTIONS, INVENTORY, CANCEL};
