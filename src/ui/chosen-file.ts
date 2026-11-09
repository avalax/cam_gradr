// A file chosen in the file input, as the browser hands it over (a File fits): its name and a way
// to read it. The stores read it themselves, so that a file the browser cannot read is named as such.
export interface ChosenFile {
  name: string;
  text: () => Promise<string>;
}
