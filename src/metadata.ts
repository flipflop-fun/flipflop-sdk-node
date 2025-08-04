/**
 * Update name, symbol and image to irys to get metadata uri
 * This module handles the complete metadata upload process:
 * 1. Validate image file type and size
 * 2. Upload image to Irys network
 * 3. Create metadata JSON with image URL and token info
 * 4. Upload metadata JSON to Irys network
 * 5. Return final metadata URL
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { CONFIGS, getNetworkType } from './config';
import { NetworkConfig } from './types';

// Constants based on frontend configuration
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const MAX_AVATAR_FILE_SIZE = 0.25 * 1024 * 1024; // 250KB

interface MetadataParams {
  name: string;
  symbol: string;
  description: string;
}

interface MetadataUploadResult {
  success: boolean;
  metadataUrl?: string;
  imageUrl?: string;
  error?: string;
}

/**
 * Validates image file type and size based on frontend validation logic
 * @param imagePath Path to the image file
 * @returns Object with validation result and error message if any
 */
const validateImageFile = (imagePath: string): { valid: boolean; error?: string } => {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return { valid: false, error: 'Image file does not exist' };
    }

    // Get file stats
    const stats = fs.statSync(imagePath);
    
    // Check file size (250KB limit)
    if (stats.size > MAX_AVATAR_FILE_SIZE) {
      return { 
        valid: false, 
        error: `Image size ${(stats.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${MAX_AVATAR_FILE_SIZE / 1024 / 1024}MB` 
      };
    }

    // Check file type using extension and mime type detection
    const extension = path.extname(imagePath).toLowerCase();
    const mimeTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif'
    };

    const mimeType = mimeTypeMap[extension];
    if (!mimeType || !VALID_IMAGE_TYPES.includes(mimeType)) {
      return { 
        valid: false, 
        error: `Invalid image format. Supported formats: ${VALID_IMAGE_TYPES.join(', ')}` 
      };
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Error validating image: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

/**
 * Uploads file to Irys network
 * @param filePath Path to the file to upload
 * @param action Type of upload (avatar, banner, metadata)
 * @returns Promise resolving to the uploaded file URL
 */
const uploadToStorage = async (config: NetworkConfig, filePath: string, action: string = 'avatar'): Promise<string> => {
  const uploadApiUrl = `${config.apiBaseUrl}/api/irys/upload`;
  
  try {
    const formData = new FormData();
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = getMimeType(filePath);
    
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType
    });
    formData.append('action', action);

    const response = await axios.post(uploadApiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      }
    });

    if (response.data.status === 'success') {
      const itemId = response.data.fileInfo.itemId;
      return `${config.irysGatewayUrl}/${itemId}`;
    } else {
      throw new Error(`Upload failed: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('Error uploading to storage:', error);
    throw error;
  }
};

/**
 * Determines MIME type based on file extension
 * @param filePath Path to the file
 * @returns MIME type string
 */
const getMimeType = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypeMap: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.json': 'application/json'
  };
  
  return mimeTypeMap[extension] || 'application/octet-stream';
};

/**
 * Creates metadata JSON object and uploads it to Irys
 * @param params Metadata parameters
 * @param imageUrl URL of the uploaded image
 * @returns Promise resolving to the metadata URL
 */
const createAndUploadMetadata = async (config: NetworkConfig, params: MetadataParams, imageUrl: string): Promise<string> => {
  const metadata = {
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    image: imageUrl,
    extensions: {
      website: '',
      twitter: '',
      discord: '',
      telegram: '',
      github: '',
      medium: '',
    }
  };

  // Create temporary metadata file
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const metadataPath = path.join(tempDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  try {
    const metadataUrl = await uploadToStorage(config, metadataPath, 'metadata');
    
    // Clean up temporary file
    fs.unlinkSync(metadataPath);
    
    return metadataUrl;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    throw error;
  }
};

/**
 * Main function to generate metadata URI from command line parameters
 * @param name Token name
 * @param symbol Token symbol
 * @param description Token description
 * @param imagePath Path to the image file
 * @returns Promise resolving to metadata upload result
 */
interface GenerateMetadataUriOptions {
  rpc: string;
  name: string;
  symbol: string;
  description: string;
  imagePath: string;
}
const generateMetadataUri = async (options: GenerateMetadataUriOptions): Promise<MetadataUploadResult> => {
  try {
    const config = CONFIGS[getNetworkType(options.rpc)]
    // Step 1: Validate image file
    console.log('Step 1: Validating image file...');
    const validation = validateImageFile(options.imagePath);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Step 2: Upload image to Irys
    console.log('Step 2: Uploading image to Irys network...');
    const imageUrl = await uploadToStorage(config, options.imagePath, 'avatar');
    console.log(`Image uploaded successfully: ${imageUrl}`);

    // Step 3: Create and upload metadata
    console.log('Step 3: Creating and uploading metadata...');
    const metadataUrl = await createAndUploadMetadata(
      config,
      { name: options.name, symbol: options.symbol, description: options.description },
      imageUrl
    );
    console.log(`Metadata uploaded successfully: ${metadataUrl}`);

    return {
      success: true,
      metadataUrl,
      imageUrl
    };

  } catch (error) {
    console.error('Error generating metadata URI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Export individual functions for advanced usage
export {
  validateImageFile,
  uploadToStorage,
  createAndUploadMetadata,
  getMimeType,
  generateMetadataUri
};
