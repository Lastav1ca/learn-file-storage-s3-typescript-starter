import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import { type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "node:path";
import { randomBytes } from "node:crypto";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData()
  const img = formData.get("thumbnail")

  if (!(img instanceof File)){
    throw new BadRequestError("File found is not an image")
  }

  if (img.size > MAX_UPLOAD_SIZE){
    throw new BadRequestError("File too large")
  } 

  const mediaType = img.type;

  if (mediaType !== 'image/jpeg' && mediaType !== 'image/png'){
    throw new BadRequestError("Invalid file type")
  }

  const arrBuffer = await img.arrayBuffer()

  const video = getVideo(cfg.db, videoId)

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (video.userID !== userID){
    throw new UserForbiddenError("You are not this videos owner")
  }

  const extension = mediaType.split('/')[1]

  const fileName = randomBytes(32).toString("base64url")

  const thumbnailPath = path.join(cfg.assetsRoot, fileName + "." + extension)
  
  await Bun.write(thumbnailPath, arrBuffer)

  video.thumbnailURL = `http://localhost:${cfg.port}/assets/${fileName}.${extension}`

  updateVideo(cfg.db, video)

  return respondWithJSON(200, video);
}
