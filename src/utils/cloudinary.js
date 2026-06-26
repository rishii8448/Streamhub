import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (localFilePath) => {
    if (!localFilePath) return null; // 🔴 THIS IS IMPORTANT

    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
    console.error("❌ Cloudinary Upload Error:", error?.message || error);

    if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
    }

    return null;
}

};

export { uploadToCloudinary };
