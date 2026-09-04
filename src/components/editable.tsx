import { useEffect, useRef } from "preact/hooks";

// Component accept text, placeholder values and also pass what type of Input - input, textarea so that we can use it for styling accordingly
// const Editable = ({
//     text,
//     type,
//     placeholder,
//     onChange,
//     ...props
// }) => {
//     // Manage the state whether to show the label or the input box. By default, label will be shown.
//     // Exercise: It can be made dynamic by accepting initial state as props outside the component 
//     const [isEditing, setEditing] = useState(false);
//     const ref = useRef<HTMLInputElement>(null);
//     // Event handler while pressing any key while editing
//     // const handleKeyDown = (event, type) => {
//     //     // Handle when key is pressed
//     // };

//     /*
//     - It will display a label is `isEditing` is false
//     - It will display the children (input or textarea) if `isEditing` is true
//     - when input `onBlur`, we will set the default non edit mode
//     Note: For simplicity purpose, I removed all the classnames, you can check the repo for CSS styles
//     */

//     useEffect(() => {
//         if (isEditing) {
//             ref?.current?.focus();
//         }
//     }, [isEditing]);


//     return (
//         <section {...props}>
//             {isEditing ? (
//                 <div
//                     onBlur={() => setEditing(false)}
//                 // onKeyDown={e => handleKeyDown(e, type)}
//                 >
//                     <input
//                         ref={ref}
//                         type="text"
//                         name="task"
//                         placeholder="Nombre de la pestaña"
//                         value={text}
//                         onChange={e => {
//                             const value = e?.target!['value']
//                             if (value) {
//                                 // console.log('send', value)
//                                 onChange(value)
//                             }
//                         }}
//                         onBlur={() => setEditing(false)}
//                         className={`rounded-lg border border-gray-300 p-2 w-full`}
//                     />
//                 </div>
//             ) : (
//                 <div
//                     onClick={() => setEditing(true)}
//                 >
//                     <span>
//                         {text || placeholder || "Editable content"}
//                     </span>
//                 </div>
//             )}
//         </section>
//     );
// };

// export default Editable;

interface EditableLabelProps {
    text: string;
    onChange: (value: string) => void;
    className?: string;
    /** Fuera de la pestaña activa el label es sólo texto: en un teléfono, un
     *  contentEditable siempre encendido abre el teclado en cada toque. */
    editable?: boolean;
}

const EditableLabel = ({ text, onChange, className, editable = true }: EditableLabelProps) => {
    const labelRef = useRef<HTMLLabelElement>(null);

    // Mientras se edita, el contenido del nodo lo maneja el navegador. Por eso el
    // JSX no declara hijos y este efecto es el único que escribe en él: antes
    // convivían `{text}` (que diffea Preact) y este `textContent`, dos dueños del
    // mismo nodo. Preact ignora los hijos que no creó él, así que no lo pisa.
    // La comparación evita reescribir el nodo -y perder el cursor- en cada
    // re-render mientras el usuario está tipeando.
    useEffect(() => {
        const el = labelRef.current;
        if (el && el.textContent !== text) el.textContent = text;
    }, [text]);

    const commit = (el: HTMLLabelElement) => {
        const value = (el.textContent || '').replace(/[\n\r]+/g, ' ').trim();
        // Si queda vacío se restaura el valor previo acá mismo: al no cambiar la
        // prop no habría re-render, y el label se quedaría en blanco para siempre.
        if (!value) return void (el.textContent = text);
        if (value !== text) onChange(value);
    };

    return (
        <label
            ref={labelRef}
            contentEditable={editable}
            spellcheck={false}
            class={className}
            onBlur={(e) => commit(e.currentTarget as HTMLLabelElement)}
            onKeyDown={(e) => {
                const el = e.currentTarget as HTMLLabelElement;
                // Enter confirma en vez de insertar un salto de línea.
                if (e.key === 'Enter') {
                    e.preventDefault();
                    el.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    el.textContent = text;
                    el.blur();
                }
            }}
        />
    );
};

export default EditableLabel;