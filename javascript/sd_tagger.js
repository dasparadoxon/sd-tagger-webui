let observeProperty = (obj, property, callback, time = 250, compare) => {
    let initial = obj[property];
    setInterval(() => {
        let now = obj[property];
        if(compare) {
            if(compare(initial, now)) {
                callback(now);
            }
        } else {
            if(initial !== now) {
                callback(now);
            }
        }
        initial = now;
    }, time);
}

let onPageLoad = () => {

    let crop = {};

    let initCropper = () => {

        let cancel = () => {
            ti.pressed = false;
            ti.press_x = undefined;
            ti.press_y = undefined;
        }

        let mousemove = (e) => {
            cropperUpdate(e.pageX, e.pageY);
            e.preventDefault();
        }

        let mousedown = (e) => {
            ti.pressed = true;
            ti.press_x = e.pageX;
            ti.press_y = e.pageY;

            // Cancel Crop
            if(e.button === 2) {
                cancel();
            }

            e.preventDefault();
        }

        let mouseup = (e) => {
            if(e.button === 0) {
                cancel();

                // Send for Crop
                cd.value = JSON.stringify(crop);
                cd.dispatchEvent(new CustomEvent("input", {}));
                cb.click();
            }
            e.preventDefault();
        }

        ti.onmousemove = mousemove;
        ti.onmousedown = mousedown;
        ti.onmouseup = mouseup;

        ti.onmouseenter = (e) => {ti.hovering = true;}

        ti.onmouseleave = (e) => {
            ti.hovering = false;

            // Look into alternatives. (Allow holding crop when out of frame)
            //cancel(); // Can't do this, because mouse hovers over rect and triggers this
            // when trying to crop.
        }

        ti.oncontextmenu = () => {return false};

        let croppingRect = gradioApp().querySelector("#cropping_rect");

        croppingRect.onmousemove = mousemove;
        croppingRect.onmousedown = mousedown;
        croppingRect.onmouseup = mouseup;
        croppingRect.oncontextmenu = () => {return false};
    }

    let cropperUpdate = (mouseX, mouseY) => {
        let bound = gradioApp().querySelector("#display div").getBoundingClientRect();
        let rect = gradioApp().querySelector("#cropping_rect");

        rect.style.display = ti.pressed ? "block" : "none";
        //croppingRect.style.display = ti.hovering ? "block" : "none"; // Another mode

        if(ti.pressed) {
            let x = ti.press_x - bound.x;
            let y = ti.press_y - bound.y
            let width = mouseX - ti.press_x;
            let height = mouseY - ti.press_y;

            // Chunking
            let chunk = 64;

            width = Math.round(width / chunk) * chunk;
            height = Math.round(height / chunk) * chunk;

            let endX = x + width;
            let endY = y + height;

            if (endX > bound.width)
                width = width - (endX - bound.width)
            if (endY > bound.height)
                height = height - (endY - bound.height)

            rect.style.left = x + "px";
            rect.style.top = y + "px";
            rect.style.width = width + "px";
            rect.style.height = height + "px";

            let sizeRatio = ti.naturalWidth / bound.width;

            crop = {
                x1: Math.floor(x * sizeRatio),
                y1: Math.floor(y * sizeRatio),
                x2: Math.floor((x + width) * sizeRatio),
                y2: Math.floor((y + height) * sizeRatio)
            };
        }
    }

    // Reload the tags from the gradio tag data (e.g. tags were loaded from txt file)
    let reloadTags = () => {
        if(!td.value)
            return;

        ts.value = ""; // Reset Search
        tgli.innerHTML = ""; // Remove Buttons

        let tags = JSON.parse(td.value.replaceAll("\'", "\""));
        for (let i = 0; i < tags.length; i++) {
            let tagButton = tb.cloneNode(true);
            tagButton.id = "";
            tagButton.innerText = tags[i];
            tagButton.onclick = () => {
                if (tagButton.classList.contains("gr-button-primary")) {
                    tagButton.classList.remove("gr-button-primary");
                    if(dt.value) {
                        let split = dt.value.split(", ");
                        dt.value = split.filter(tag => tag !== tagButton.innerText).join(", ");
                    }
                } else {
                    tagButton.classList.add("gr-button-primary");
                    if(dt.value) {
                        dt.value = dt.value + ", " + tagButton.innerText;
                    } else {
                        dt.value = tagButton.innerText;
                    }
                }
                dt.dispatchEvent(new CustomEvent("input", {}));
                st.click();

            };
            tagButton.classList.remove("d-none");
            tgli.appendChild(tagButton);
        }
    }

    // Update the tag states (e.g. switching images)
    let updateTags = () => {
        let split = dt.value.split(",").map((s) => {
            return s.trim();
        });

        let buttons = tgli.getElementsByTagName("button");

        // Return if buttons not loaded
        if(buttons.length === 0)
            return;

        for(let i = 0; i < buttons.length; i++) {
            if(split.includes(buttons[i].innerText)) {
                if (!buttons[i].classList.contains("gr-button-primary")) {
                    buttons[i].classList.add("gr-button-primary");
                }
            } else {
                buttons[i].classList.remove("gr-button-primary");
            }
        }
    }

    /// TODO Proper Naming
    let tg = gradioApp().querySelector("#tag_list");
    let tgli = gradioApp().querySelector("#tag_list_inner");
    let tb = gradioApp().querySelector("#example_tag");
    let td = gradioApp().querySelector("#tags_data textarea");
    let dt = gradioApp().querySelector("#display_tags textarea");
    let st = gradioApp().querySelector("#save_tags");
    let ts = gradioApp().querySelector("#tag_search");
    let tic = gradioApp().querySelector("#tagging_image");
    let ti = gradioApp().querySelector("#tagging_image img");
    let dd = gradioApp().querySelector("#display_data img");
    let cd = gradioApp().querySelector("#crop_data textarea");
    let cb = gradioApp().querySelector("#crop_button");

    // Format Tagging Image Container
    tic.style.maxHeight = "500px";

    let postImageLoad = setInterval(() => {
        ti = gradioApp().querySelector("#tagging_image img");
        if(ti) {

            let display = gradioApp().querySelector("#display div");
            display.appendChild(ti);

            // Format Tagging Image
            ti.style.maxHeight = "500px";
            ti.classList.remove("w-full");
            ti.classList.add("h-full");
            ti.classList.add("tagging-img");

            // Activate Image Cropper
            initCropper();

            clearInterval(postImageLoad);
        }
    }, 250);

    /// TODO Replace these with event calling
    observeProperty(ts, "value", (text) => {
        let buttons = tgli.childNodes;
        for(let i = 0; i < buttons.length; i++) {
            if(buttons[i].innerText.toLowerCase().startsWith(text)) {
                buttons[i].style.display = "";
            } else {
                buttons[i].style.display = "none";
            }
        }
    }, 250);

    observeProperty(td, "value", () => {
        reloadTags();
        updateTags();
    }, 1000);

    observeProperty(dt, "value", () => {
        updateTags();
    }, 250);

    /*observeProperty(td, "value", () => {
        ti.src = dd.src;
    }, 250);*/
}


/// TODO Messy
let interval = setInterval(() => {
    let tg = gradioApp().querySelector("#tag_list");
    if(tg) {
        onPageLoad();
        clearInterval(interval);
    }
}, 1000);