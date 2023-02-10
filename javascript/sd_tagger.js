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
    let shiftKey = false;
    let lastX, lastY;
    let originalTags;

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
            lastX = e.pageX;
            lastY = e.pageY;
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

        document.addEventListener("keydown", (e) => {
            if(!shiftKey && e.shiftKey) {
                shiftKey = e.shiftKey
                cropperUpdate(lastX, lastY);
            }
        });

        document.addEventListener("keyup", (e) => {
            if(shiftKey && !e.shiftKey) {
                shiftKey = e.shiftKey
                cropperUpdate(lastX, lastY);
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
            let x = ti.press_x - bound.x - pageXOffset;
            let y = ti.press_y - bound.y - pageYOffset;
            let width = Math.abs(mouseX - ti.press_x);
            let height = Math.abs(mouseY - ti.press_y);

            // How much the image is zoomed in
            let zoomRatio = ti.naturalWidth / bound.width;

            // Snapping
            let snap = cc.value * (1 / zoomRatio);

            width = Math.round(width / snap) * snap;
            height = Math.round(height / snap) * snap;

            if(shiftKey)
                if(width >= height)
                    height = width;
                else
                    width = height;

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

            // Update image size text
            if(width > 0 && height > 0) {
                rect.style.padding = "5px";
                rect.innerText = Math.ceil(width * zoomRatio) + "x" + Math.ceil(height * zoomRatio);
            } else {
                rect.style.padding = "0px";
                rect.innerText = "";
            }

            crop = {
                x1: Math.floor(x * zoomRatio),
                y1: Math.floor(y * zoomRatio),
                x2: Math.floor((x + width) * zoomRatio),
                y2: Math.floor((y + height) * zoomRatio)
            };
        }
    }

    // Reload the tags from the gradio tag data (e.g. tags were loaded from txt file)
    let reloadTags = () => {
        // If no tags found
        if(!td.value)
            return;

        tgli.innerHTML = ""; // Remove Buttons

        let tags = td.value.split(",");
        let tagCount = 0;

        for (let i = 0; i < tags.length; i++) {
            // Maximum tag count
            if(tagCount > mtc.value)
                break;
            if(!tags[i].toLowerCase().startsWith(ts.value.toLowerCase()))
                continue;

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
            tagCount++;
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
    let ai = gradioApp().querySelector("#setting_auto_interrogate input");
    let mtc = gradioApp().querySelector("#setting_max_tag_count input");

    let ib = gradioApp().querySelector("#interrogate_button");

    let dti = gradioApp().querySelector("#display_tags_internal textarea");



    let ii = gradioApp().querySelector("#image_index #image_index");

    let rt = gradioApp().querySelector("#reload_tags");

    let ct = gradioApp().querySelector("#clear_tags");

    let rvt = gradioApp().querySelector("#revert_tags");

    // Clear tags button
    if(ct) {
        ct.onclick = () => {
            dt.value = "";
            updateTags();
            sendDisplayUpdate();
        }

        rvt.onclick = () => {
            dt.value = originalTags;
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

    rt.onclick = () => {
        reloadTags();
        updateTags();
    };

    ts.oninput = () => {
        reloadTags();
        updateTags();
    };

    /// TODO Replace these with event calling
    // When tag data get updated (invisible element)
    observeProperty(td, "value", () => {
        reloadTags();
        updateTags();
    }, 1000);

    // When tags are being typed
    dt.oninput = () => {
        updateTags();
        sendDisplayUpdate();
    };

    // ...
    observeProperty(dti, "value", () => {
        updateDisplayTags();
        updateTags();
    }, 250);

    // Image Change
    observeProperty(ii, "innerText", () => {
        onImageChange();

        // Save original tags
        originalTags = dti.value;

        // Auto interrogate // TODO Improve
        if(ai.checked)
            ib.click()
    }, 250);
}


/// TODO Everything is messy.
let interval = setInterval(() => {
    let tg = gradioApp().querySelector("#tag_list");
    if(tg) {
        onPageLoad();
        clearInterval(interval);
    }
}, 1000);