export function timetableShape(data:Record<string,unknown>){
  const isCell=(key:string,value:unknown)=>/^(?:cells\.)?d[0-5]p[1-7]$/.test(key)&&value!==null&&typeof value==='object'&&!Array.isArray(value)
  return {
    fields:Object.keys(data).length,
    flat:Object.entries(data).filter(([key,value])=>isCell(key,value)).length,
    nested:data.cells&&typeof data.cells==='object'&&!Array.isArray(data.cells)?Object.entries(data.cells).filter(([key,value])=>isCell(key,value)).length:0,
  }
}
