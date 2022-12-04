"use strict";

export function toggleAllButtons(disabled){
    for (let button of document.querySelectorAll("#menu>*>button")) button.disabled = disabled;
}