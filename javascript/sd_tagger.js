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

    let initResizer = () => {
        let resizeButton = gradioApp().querySelector("#resize_display");
        let display = gradioApp().querySelector("#display");
        let bound = display.getBoundingClientRect();

        let drag = false;
        let downY = 0;

        document.addEventListener("mousemove", (e) => {
            if(drag) {
                display.style.height = (e.pageY - bound.y + 10) + "px";
            }
        });

        resizeButton.onmousedown = (e) => {
            drag = true;
            downY = e.pageY;
        }

        document.addEventListener("mouseup", (e) => {drag = false;});
    }

    let initCropper = () => {
        let cancelContext = false;

        let cancel = () => {
            ti.pressed = false;
            ti.press_x = undefined;
            ti.press_y = undefined;
        }

        let mousemove = (e) => {
            cropperUpdate(e.pageX, e.pageY);
            //e.preventDefault();
        }

        let mousedown = (e) => {
            ti.pressed = true;
            ti.press_x = e.pageX;
            ti.press_y = e.pageY;
            //e.preventDefault();
        }

        let mouseup = (e) => {
            if(e.button === 0) {
                if(ti.pressed) {
                    // Send for Crop
                    cd.value = JSON.stringify(crop);
                    cd.dispatchEvent(new CustomEvent("input", {}));
                    cb.click();
                }
                cancel();
            }
            //e.preventDefault();
        }

        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", mouseup);
        document.addEventListener("mousedown", (e) => {
            if(e.button === 2 && ti.pressed) {
                cancel();
                cancelContext = true;
            }
        });

        document.addEventListener("contextmenu", (e) => {
            if(cancelContext) {
                e.preventDefault();
                cancelContext = false;
                return false;
            }
        });

        let croppingRect = gradioApp().querySelector("#cropping_rect");

        // Connect to display image
        ti.onmouseenter = (e) => {ti.hovering = true;}
        ti.onmouseleave = (e) => {ti.hovering = false;}
        ti.onmousedown = mousedown;

        // Edge case: include cropping rectangle with mousedown
        croppingRect.onmousedown = mousedown;

    }

    let cropperUpdate = (mouseX, mouseY) => {
        // TODO Improve naming
        let bound = gradioApp().querySelector("#display img").getBoundingClientRect();
        let rect = gradioApp().querySelector("#cropping_rect");

        rect.style.display = ti.pressed ? "block" : "none";
        //croppingRect.style.display = ti.hovering ? "block" : "none"; // Another mode

        if(ti.pressed) {
            // Calculate relative image coordinates for rectangle
            let x = ti.press_x - bound.x;
            let y = ti.press_y - bound.y
            let width = Math.abs(mouseX - ti.press_x);
            let height = Math.abs(mouseY - ti.press_y);

            // Snapping
            let snap = cc.value;

            width = Math.round(width / snap) * snap;
            height = Math.round(height / snap) * snap;

            // Realign to top-left corner of rectangle if we're cropping backwards
            let dx = (mouseX - bound.x) - x;
            let dy = (mouseY - bound.y) - y;

            if(dx < 0) {
                x -= width;
            }
            if(dy < 0) {
                y -= height;
            }

            // Check image borders
            if(x < 0) {
                width += x;
                x = 0;
            }
            if(y < 0) {
                height += y;
                y = 0;
            }

            let endX = x + width;
            let endY = y + height;

            if (endX > bound.width)
                width = width - (endX - bound.width)
            if (endY > bound.height)
                height = height - (endY - bound.height)

            // Update visual
            rect.style.left = x + "px";
            rect.style.top = y + "px";
            rect.style.width = width + "px";
            rect.style.height = height + "px";

            // Multiply the size difference between the real image and the display.
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
                        // TODO Write a function for sanitizing the tag box
                        // Make removing empty tags optional.
                        let split = dt.value.split(",").map((s) => {
                            return s.trim();
                        });
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
            };
            tagButton.classList.remove("d-none");
            tgli.appendChild(tagButton);
        }
    }

    // Update the tag states (e.g. when switching images)
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

    let updateDisplayTags = () => {
        dt.value = dti.value;
    };

    let sendDisplayUpdate = () => {
        dti.value = dt.value;
        dti.dispatchEvent(new CustomEvent("input", {}));
    };

    let onImageChange = () => {
        updateTags();
    };

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
    let dh = gradioApp().querySelector("#display_html");

    let cc = gradioApp().querySelector("#setting_cropper_snap input");

    let dti = gradioApp().querySelector("#display_tags_internal textarea");

    let ct = gradioApp().querySelector("#clear_tags");

    let ii = gradioApp().querySelector("#image_index #image_index");

    // Clear tags button
    if(ct) {
        ct.onclick = () => {
            dt.value = "";
            updateTags();
            sendDisplayUpdate();
        }
    }

    // Hide display-box
    dh.style.display = "none";

    let postImageLoad = setInterval(() => {
        ti = gradioApp().querySelector("#tagging_image img");
        if(ti) {
            let display_inner = gradioApp().querySelector("#display div");
            let display = gradioApp().querySelector("#display");
            let old_html = gradioApp().querySelector("#tagging_image");

            old_html.style.position = "absolute";
            old_html.style.top = "100%";
            old_html.style.border = "none";

            display_inner.appendChild(ti);
            display.appendChild(old_html);

            // Make display-box visible
            dh.style.display = "block";

            // Format Tagging Image
            ti.classList.remove("w-full");
            ti.classList.add("h-full");
            ti.classList.add("tagging-img");

            // Activate Display Resize Button
            initResizer();

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

    dt.oninput = () => {
        updateTags();
        sendDisplayUpdate();
    };

    observeProperty(dti, "value", () => {
        updateDisplayTags();
    }, 250);

    observeProperty(ii, "innerText", () => {
        onImageChange();
    }, 250);
}


/// TODO Messy
let interval = setInterval(() => {
    let tg = gradioApp().querySelector("#tag_list");
    if(tg) {
        onPageLoad();
        clearInterval(interval);
    }
}, 1000);