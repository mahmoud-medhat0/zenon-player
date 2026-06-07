import { useState, useEffect, ImgHTMLAttributes } from 'react';
import axios from 'axios';

interface SecureImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export default function SecureImage({ src, alt, className, style, ...props }: SecureImageProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchImage = async () => {
      try {
        const response = await axios.get(src, { responseType: 'blob' });
        objectUrl = URL.createObjectURL(response.data);
        setImgSrc(objectUrl);
      } catch (error) {
        console.error('Error fetching image:', error);
      }
    };

    if (src) {
      fetchImage();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!imgSrc) {
    return <div className={className} style={{ backgroundColor: 'var(--bg-dark)', ...style } as React.CSSProperties} />;
  }

  return <img src={imgSrc} alt={alt} className={className} style={style} {...props} />;
}
