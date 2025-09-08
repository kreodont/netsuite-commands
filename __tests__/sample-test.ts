
import {EmptyCommand} from "../EmptyCommand";


test("Command example", () => {
    const c = new EmptyCommand(`Some empty command`)
    expect(c.toStr()).toEqual(`{"type":"EmptyCommand","group":"EmptyGroup","details":"Some empty command"}`)

});
