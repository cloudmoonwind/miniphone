/**
 * Express 类型增强
 *
 * 所有子路由通过 mergeParams:true 从父路由继承 :charId。
 * 由于 TypeScript 无法静态分析 mergeParams，在此全局扩展 ParamsDictionary
 * 使 req.params.charId 等访问通过类型检查。
 *
 * 待 Phase 8（strict 模式）时，可改为每个路由文件单独声明 Request<{charId:string}>。
 */
declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    charId?: string;
    [key: string]: string | undefined;
  }
}
