const Programming = () => {
    return (
        <div style={{ width: '100%', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>
            <iframe
                src="https://onlinecompiler.online"
                title="Online Compiler"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                }}
                allow="clipboard-read; clipboard-write"
            />
        </div>
    );
};

export default Programming;
