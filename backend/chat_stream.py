"""SSE transport for the docs assistant; client disconnects do not cancel persistence."""
import asyncio
import json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

_tasks = set()


async def stream_response(operation):
    queue = asyncio.Queue(maxsize=512)
    connected = True
    ready = asyncio.get_running_loop().create_future()
    ready.add_done_callback(lambda future: future.exception() if not future.cancelled() else None)

    def emit(event, data):
        nonlocal connected
        if not ready.done():
            ready.set_result(None)
        if not connected:
            return
        if queue.full():
            connected = False
            while not queue.empty():
                queue.get_nowait()
            queue.put_nowait(("session.error", {"message": "Yanıt akışı kesildi. Sohbeti yeniden açın."}))
            return
        queue.put_nowait((event, data))

    async def produce():
        try:
            emit("session.completed", await operation(emit))
        except Exception as error:
            if not ready.done():
                ready.set_exception(error)
            else:
                emit("session.error", {"message": error.detail if isinstance(error, HTTPException) else "Vera yanıtı tamamlayamadı."})

    task = asyncio.create_task(produce())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    try:
        await asyncio.shield(ready)
    except BaseException:
        connected = False
        raise

    async def events():
        nonlocal connected
        try:
            while True:
                try:
                    event, data = await asyncio.wait_for(queue.get(), 15)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                if event in {"session.completed", "session.error"}:
                    return
        finally:
            connected = False
            while not queue.empty():
                queue.get_nowait()

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
