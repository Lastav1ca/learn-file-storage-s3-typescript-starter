import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import { type BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { UserForbiddenError, NotFoundError, BadRequestError } from "./errors";
import path from "node:path";

const MAX_UPLOAD_SIZE = 1 << 30;

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userId = validateJWT(token, cfg.jwtSecret)

  const video = getVideo(cfg.db, videoId)

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (userId !== video.userID){
    throw new UserForbiddenError("You are not this videos owner!")
  }

  const formData = await req.formData()
  const file = formData.get("video")
  
  if (!(file instanceof File)){
    throw new BadRequestError("File found is not a video")
  }

  if (file.size > MAX_UPLOAD_SIZE){
    throw new BadRequestError("Video is too large")
  }

  if (file.type !== 'video/mp4'){
    throw new BadRequestError("File must be a video/mp4")
  }

  const videoKey = `${videoId}.mp4`

  const tempPath = path.join("/tmp", videoKey)

  try{
    await Bun.write(tempPath, file)

    await cfg.s3Client.file(videoKey).write(Bun.file(tempPath), {type : file.type})

    video.videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${videoKey}`

    updateVideo(cfg.db, video)
  }finally{
    await Bun.file(tempPath).delete()
  }
  return respondWithJSON(200, video);
}
