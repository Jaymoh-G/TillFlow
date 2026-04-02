import { image_path } from "../../environment";
import React from "react";



const ImageWithBasePath = (props) => {
  // Combine the base path and the provided src to create the full image source URL
  const fullSrc = `${image_path}${props.src}`;
  return (
    <img
      className={props.className}
      src={fullSrc}
      height={props.height}
      alt={props.alt}
      width={props.width}
      id={props.id}
    />
  );
};

export default React.memo(ImageWithBasePath);
