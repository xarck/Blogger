import { useContext } from "react";
import { EditorContext } from "../pages/editor.pages";

const Tag = ({ tag, tagIndex }) => {
    let { blog, setBlog } = useContext(EditorContext);

    const addEditable = (e) => {
        e.target.setAttribute("contentEditable", true);
        e.target.focus();
    }

    const handleTagEdit = (e) => {
        if (e.keyCode == 13 || e.keyCode == 188) {

            e.preventDefault();
            const currentTag = e.target.innerText;
            const updatedTags = [...blog.tags]; // Make a copy of the tags array
            updatedTags[tagIndex] = currentTag;
            setBlog({ ...blog, tags: updatedTags })
            e.target.setAttribute("contentEditable", false);
            console.log(blog.tags)



        }
    }

    const handleTagDelete = () => {
        const updatedTags = blog.tags.filter(t => t !== tag);
        setBlog({ ...blog, tags: updatedTags });
        console.log(blog.tags)

    }


    return (
        <div className="relative p-2 mt-2 mr-2 px-5 bg-white rounded-full inline-block hover:bg-opacity-50 pr-10">
            <p className="outline-none"
                onKeyDown={handleTagEdit}
                onClick={addEditable}
            >{tag}</p>
            <button className=" mt-[2px] rounded-full absolute right-3 top-1/2 -translate-y-1/2 "
                onClick={handleTagDelete}>
                <i className="fi fi-br-cross-small text-small pointer-events-none"></i>
            </button>
        </div>
    )
}
export default Tag;