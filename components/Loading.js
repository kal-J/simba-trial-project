export default ({ message }) => {
  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen absolute top-0 left-0 right-0 bottom-0 bg-black opacity-60">
      
      <div className="flex justify-center text-white my-2">
        {message ? message : "processing..."}
      </div>
    </div>
  );
};
