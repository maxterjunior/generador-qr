import { useEffect, useRef, useState } from "preact/hooks";

// Component accept text, placeholder values and also pass what type of Input - input, textarea so that we can use it for styling accordingly
const Editable = ({
    text,
    type,
    placeholder,
    onChange,
    ...props
}) => {
    // Manage the state whether to show the label or the input box. By default, label will be shown.
    // Exercise: It can be made dynamic by accepting initial state as props outside the component 
    const [isEditing, setEditing] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    // Event handler while pressing any key while editing
    // const handleKeyDown = (event, type) => {
    //     // Handle when key is pressed
    // };

    /*
    - It will display a label is `isEditing` is false
    - It will display the children (input or textarea) if `isEditing` is true
    - when input `onBlur`, we will set the default non edit mode
    Note: For simplicity purpose, I removed all the classnames, you can check the repo for CSS styles
    */

    useEffect(() => {
        if (isEditing) {
            ref?.current?.focus();
        }
    }, [isEditing]);


    return (
        <section {...props}>
            {isEditing ? (
                <div
                    onBlur={() => setEditing(false)}
                    // onKeyDown={e => handleKeyDown(e, type)}
                >
                    <input
                        ref={ref}
                        type="text"
                        name="task"
                        placeholder="Nombre de la pestaña"
                        value={text}
                        onChange={e => {
                            const value = e?.target!['value']
                            if (value) {
                                // console.log('send', value)
                                onChange(value)
                            }
                        }}
                        onBlur={() => setEditing(false)}
                        className={`rounded-lg border border-gray-300 p-2 w-full`}
                    />
                </div>
            ) : (
                <div
                    onClick={() => setEditing(true)}
                >
                    <span>
                        {text || placeholder || "Editable content"}
                    </span>
                </div>
            )}
        </section>
    );
};

export default Editable;