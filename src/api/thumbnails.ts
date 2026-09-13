import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

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

  const arrBuffer = await img.arrayBuffer()

  const buffer = Buffer.from(arrBuffer).toString("base64")

  const dataUrl = `data:${mediaType};base64,${buffer}`

  const video = getVideo(cfg.db, videoId)

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (video.userID !== userID){
    throw new UserForbiddenError("You are not this videos owner")
  }

  video.thumbnailURL = dataUrl

  updateVideo(cfg.db, video)

  return respondWithJSON(200, video);
}
