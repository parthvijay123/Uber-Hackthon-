declare module "uuid";
declare module "express";
declare module "cors";


import "express-serve-static-core"

declare module "express-serve-static-core" {
  interface Request {
    params: any
  }
}